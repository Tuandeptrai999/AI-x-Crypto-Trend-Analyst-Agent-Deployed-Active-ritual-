// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─── System contracts ──────────────────────────────────────────────────────────
interface IRitualWallet {
    function deposit(uint256 lockDuration) external payable;
    function balanceOf(address account) external view returns (uint256);
    function withdraw(uint256 amount) external;
}

interface IScheduler {
    function schedule(
        bytes calldata data,
        uint32 gas,
        uint32 startBlock,
        uint32 numCalls,
        uint32 frequency,
        uint32 ttl,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 value,
        address payer
    ) external returns (uint256 callId);

    function cancel(uint256 callId) external;
}

// ─── HomoMimic — Autonomous On-Chain Agent ─────────────────────────────────────
/// @title HomoMimic
/// @notice Autonomous agent using the Ritual Sovereign Agent precompile (0x080C).
///         Runs on a recurring Scheduler loop: each tick invokes a sovereign agent
///         job (See → Think → Do inside the TEE), then stores the result on-chain.
contract HomoMimic {
    // ── Ritual precompile / system addresses ───────────────────────────────────
    address constant SOVEREIGN_AGENT = address(0x080C);
    address constant ASYNC_DELIVERY  = 0x5A16214fF555848411544b005f7Ac063742f39F6;
    address constant RITUAL_WALLET   = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;
    address constant SCHEDULER_ADDR  = 0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B;

    // ── State ──────────────────────────────────────────────────────────────────
    address public owner;

    // Persistent agent config
    address public executor;
    bytes   public encodedRequest; // ABI-encoded SovereignAgentParams

    // Scheduler tracking
    uint256 public activeScheduleId;
    uint256 public executionCount;

    // Latest agent result (decoded from Phase 2 delivery)
    bytes32 public lastJobId;
    bytes   public lastResult;
    string  public lastThought;
    string  public lastAction;

    // ── Events ─────────────────────────────────────────────────────────────────
    event AgentWake(uint256 indexed executionIndex, bytes32 indexed jobId);
    event AgentResult(bytes32 indexed jobId, string thought, string action);
    event Scheduled(uint256 indexed callId, uint32 frequency, uint32 numCalls);

    // ── Modifiers ──────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyScheduler() {
        require(msg.sender == SCHEDULER_ADDR, "Not scheduler");
        _;
    }

    modifier onlyAsyncDelivery() {
        require(msg.sender == ASYNC_DELIVERY, "Not async delivery");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Transfer ownership of the contract to a new owner.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }

    // ── Funding ────────────────────────────────────────────────────────────────
    /// @notice Fund the RitualWallet so the Scheduler can pay for async jobs.
    function depositForFees() external payable {
        IRitualWallet(RITUAL_WALLET).deposit{value: msg.value}(500000);
    }

    /// @notice Check how much RITUAL is available for fees.
    function walletBalance() external view returns (uint256) {
        return IRitualWallet(RITUAL_WALLET).balanceOf(address(this));
    }

    /// @notice Withdraw RITUAL from the RitualWallet back to the owner.
    ///         Only works if the lock duration has expired.
    function withdrawFees(uint256 amount) external onlyOwner {
        IRitualWallet(RITUAL_WALLET).withdraw(amount);
        payable(owner).transfer(amount);
    }

    /// @notice Withdraw any native RITUAL balance stored in the contract itself.
    function withdrawNative(uint256 amount) external onlyOwner {
        payable(owner).transfer(amount);
    }

    // ── Configuration ──────────────────────────────────────────────────────────
    /// @notice Store the pre-encoded sovereign agent request payload.
    ///         Call this before startAgent(). Build the payload off-chain.
    function setRequest(bytes calldata _encodedRequest) external onlyOwner {
        encodedRequest = _encodedRequest;
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────────
    /// @notice Arm the recurring schedule. Each scheduled callback fires `wakeUp`,
    ///         which invokes the Sovereign Agent precompile.
    /// @param frequency   Blocks between executions (min 500 for async safety).
    /// @param numCalls    Total scheduled executions (frequency × numCalls ≤ 10,000).
    /// @param gasLimit    Gas for the scheduler callback.
    /// @param maxFeePerGas EIP-1559 max fee (wei).
    function startAgent(
        uint32  frequency,
        uint32  numCalls,
        uint32  gasLimit,
        uint256 maxFeePerGas
    ) external onlyOwner {
        require(encodedRequest.length > 0, "Request not set");
        require(activeScheduleId == 0,     "Already running");

        bytes memory callData = abi.encodeWithSelector(
            this.wakeUp.selector,
            uint256(0) // placeholder executionIndex — Scheduler overwrites
        );

        activeScheduleId = IScheduler(SCHEDULER_ADDR).schedule(
            callData,
            gasLimit,
            uint32(block.number) + frequency, // startBlock
            numCalls,
            frequency,
            500,          // ttl: must cover async settlement (~60–90 s ≈ ~200 blocks)
            maxFeePerGas,
            0,            // maxPriorityFeePerGas
            0,            // value per call
            address(this) // payer = this contract's RitualWallet balance
        );

        emit Scheduled(activeScheduleId, frequency, numCalls);
    }

    /// @notice Stop the agent loop.
    function stopAgent() external onlyOwner {
        if (activeScheduleId != 0) {
            IScheduler(SCHEDULER_ADDR).cancel(activeScheduleId);
            activeScheduleId = 0;
        }
    }

    // ── Scheduler callback ────────────────────────────────────────────────────
    /// @notice Called by the Scheduler on each execution tick.
    ///         Invokes the Sovereign Agent precompile — Phase 1 of the async lifecycle.
    ///         The TEE executor runs See→Think→Do, then delivers results via
    ///         onSovereignAgentResult (Phase 2).
    function wakeUp(uint256 executionIndex) external onlyScheduler {
        (bool ok, bytes memory output) = SOVEREIGN_AGENT.call(encodedRequest);
        require(ok, "Sovereign agent precompile failed");

        // Decode Phase 1 output: (bytes32 jobId, bytes phaseOneData)
        (bytes32 jobId,) = abi.decode(output, (bytes32, bytes));
        lastJobId = jobId;
        executionCount++;

        emit AgentWake(executionIndex, jobId);
    }

    // ── Phase 2 delivery callback ─────────────────────────────────────────────
    /// @notice Receives the sovereign agent result delivered by AsyncDelivery.
    ///         The result bytes contain the agent's full output.
    function onSovereignAgentResult(
        bytes32 jobId,
        bytes calldata result
    ) external onlyAsyncDelivery {
        lastJobId  = jobId;
        lastResult = result;

        // Attempt to decode result as (string thought, string action)
        // The sovereign agent formats output as plain text; we store it raw
        // and try a best-effort decode.
        if (result.length > 0) {
            try this._decodeResult(result) returns (string memory thought, string memory action) {
                lastThought = thought;
                lastAction  = action;
                emit AgentResult(jobId, thought, action);
            } catch {
                // Store raw if decode fails
                lastThought = string(result);
                lastAction  = "raw";
                emit AgentResult(jobId, lastThought, lastAction);
            }
        }
    }

    /// @dev External wrapper so we can use try/catch on the ABI decode.
    function _decodeResult(bytes calldata data)
        external
        pure
        returns (string memory thought, string memory action)
    {
        (thought, action) = abi.decode(data, (string, string));
    }

    receive() external payable {}
}
