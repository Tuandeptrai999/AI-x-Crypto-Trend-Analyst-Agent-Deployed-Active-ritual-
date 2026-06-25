// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRitualWallet {
    function deposit(uint256 lockDuration) external payable;
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

contract AutonomousAgent {
    address constant HTTP_PRECOMPILE = 0x0000000000000000000000000000000000000801;
    address constant LLM_PRECOMPILE = 0x0000000000000000000000000000000000000802;
    address constant RITUAL_WALLET = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;
    
    address public owner;
    address public scheduler;
    
    uint256 public activeScheduleIdSee;
    uint256 public activeScheduleIdThink;
    
    string public latestSensoryData; // See
    bytes public latestThoughtRaw;    // Think (Raw CompletionData)
    string public latestAction;       // Do
    
    uint256 public seeCount;
    uint256 public thinkCount;
    
    event AgentSee(uint256 indexed index, string data);
    event AgentThink(uint256 indexed index, bytes thoughtRaw);
    event AgentDo(uint256 indexed index, string action);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyScheduler() {
        require(msg.sender == scheduler, "Not scheduler");
        _;
    }
    
    constructor(address _scheduler) {
        owner = msg.sender;
        scheduler = _scheduler;
    }
    
    function depositForFees() external payable {
        IRitualWallet(RITUAL_WALLET).deposit{value: msg.value}(500000);
    }
    
    function startAgent(
        address executor,
        string calldata url,
        string calldata systemPrompt,
        uint32 frequency,
        uint32 numCalls,
        uint32 gasLimit,
        uint256 maxFeePerGas
    ) external onlyOwner {
        // Schedule runSee
        bytes memory dataSee = abi.encodeWithSelector(
            this.runSee.selector,
            uint256(0),
            executor,
            url
        );
        activeScheduleIdSee = IScheduler(scheduler).schedule(
            dataSee, gasLimit, uint32(block.number) + 5, numCalls, frequency, 100, maxFeePerGas, 0, 0, address(this)
        );
        
        // Schedule runThink offset by 25 blocks (half frequency)
        bytes memory dataThink = abi.encodeWithSelector(
            this.runThink.selector,
            uint256(0),
            executor,
            systemPrompt
        );
        activeScheduleIdThink = IScheduler(scheduler).schedule(
            dataThink, gasLimit, uint32(block.number) + 25, numCalls, frequency, 100, maxFeePerGas, 0, 0, address(this)
        );
    }
    
    function stopAgent() external onlyOwner {
        if (activeScheduleIdSee != 0) {
            IScheduler(scheduler).cancel(activeScheduleIdSee);
            activeScheduleIdSee = 0;
        }
        if (activeScheduleIdThink != 0) {
            IScheduler(scheduler).cancel(activeScheduleIdThink);
            activeScheduleIdThink = 0;
        }
    }
    
    // Step 1: See (Fetch external data)
    function runSee(
        uint256 executionIndex,
        address executor,
        string calldata url
    ) external onlyScheduler {
        bytes memory encoded = abi.encode(
            executor, new bytes[](0), uint256(50), new bytes[](0), bytes(""),
            url, uint8(1), // GET
            new string[](0), new string[](0), bytes(""),
            uint256(0), uint8(0), false
        );

        (bool ok, bytes memory rawOutput) = HTTP_PRECOMPILE.call(encoded);
        require(ok, "HTTP precompile failed");
        
        (, bytes memory actualOutput) = abi.decode(rawOutput, (bytes, bytes));
        (uint16 status, , , bytes memory body, string memory err) = abi.decode(
            actualOutput, (uint16, string[], string[], bytes, string)
        );
        
        if (bytes(err).length == 0 && status == 200) {
            latestSensoryData = string(body);
            emit AgentSee(executionIndex, latestSensoryData);
        } else {
            latestSensoryData = "Error fetching sensory data";
            emit AgentSee(executionIndex, latestSensoryData);
        }
        seeCount++;
    }
    
    struct ConvoHistory {
        string platform;
        string path;
        string keyRef;
    }
    
    // Step 2: Think (Reason using LLM)
    function runThink(
        uint256 executionIndex,
        address executor,
        string calldata systemPrompt
    ) external onlyScheduler {
        // Construct messages Json
        // Combine system prompt and latestSensoryData
        string memory messagesJson = string(
            abi.encodePacked(
                "[{\"role\":\"system\",\"content\":\"", systemPrompt, "\"},",
                "{\"role\":\"user\",\"content\":\"Sensory data: ", latestSensoryData, ". What do you think and do? Output: <think>your reasoning</think>action name\"}]"
            )
        );
        
        bytes memory encoded = abi.encode(
            executor, new bytes[](0), uint256(100), new bytes[](0), bytes(""),
            messagesJson, "zai-org/GLM-4.7-FP8",
            int256(0), "", false, int256(4096), "", "",
            uint256(1), true, int256(0), "medium", bytes(""), int256(-1), "auto", "",
            false, int256(700), bytes(""), bytes(""), int256(-1), int256(1000), "",
            false, ConvoHistory("", "", "")
        );

        (bool ok, bytes memory rawOutput) = LLM_PRECOMPILE.call(encoded);
        require(ok, "LLM precompile failed");
        
        (, bytes memory actualOutput) = abi.decode(rawOutput, (bytes, bytes));
        
        // Decode LLM response
        (bool hasError, bytes memory completionData, , string memory errorMessage, ) = abi.decode(
            actualOutput, (bool, bytes, bytes, string, ConvoHistory)
        );
        
        if (!hasError) {
            latestThoughtRaw = completionData;
            latestAction = "Action determined by thought";
            emit AgentThink(executionIndex, latestThoughtRaw);
            emit AgentDo(executionIndex, latestAction);
        } else {
            latestThoughtRaw = abi.encode(errorMessage);
            latestAction = "Error Action";
            emit AgentThink(executionIndex, latestThoughtRaw);
            emit AgentDo(executionIndex, latestAction);
        }
        thinkCount++;
    }
    
    // Direct call mechanism for frontend testing/interactive triggers
    function triggerSeeDirect(address executor, string calldata url) external returns (string memory) {
        bytes memory encoded = abi.encode(
            executor, new bytes[](0), uint256(50), new bytes[](0), bytes(""),
            url, uint8(1), // GET
            new string[](0), new string[](0), bytes(""),
            uint256(0), uint8(0), false
        );
        (bool ok, bytes memory rawOutput) = HTTP_PRECOMPILE.call(encoded);
        require(ok, "HTTP precompile failed");
        (, bytes memory actualOutput) = abi.decode(rawOutput, (bytes, bytes));
        (uint16 status, , , bytes memory body, string memory err) = abi.decode(
            actualOutput, (uint16, string[], string[], bytes, string)
        );
        if (bytes(err).length == 0 && status == 200) {
            latestSensoryData = string(body);
        } else {
            latestSensoryData = "Error fetching sensory data";
        }
        return latestSensoryData;
    }

    function triggerThinkDirect(address executor, string calldata systemPrompt) external returns (bytes memory) {
        string memory messagesJson = string(
            abi.encodePacked(
                "[{\"role\":\"system\",\"content\":\"", systemPrompt, "\"},",
                "{\"role\":\"user\",\"content\":\"Sensory data: ", latestSensoryData, ". What do you think and do? Output: <think>your reasoning</think>action name\"}]"
            )
        );
        bytes memory encoded = abi.encode(
            executor, new bytes[](0), uint256(100), new bytes[](0), bytes(""),
            messagesJson, "zai-org/GLM-4.7-FP8",
            int256(0), "", false, int256(4096), "", "",
            uint256(1), true, int256(0), "medium", bytes(""), int256(-1), "auto", "",
            false, int256(700), bytes(""), bytes(""), int256(-1), int256(1000), "",
            false, ConvoHistory("", "", "")
        );
        (bool ok, bytes memory rawOutput) = LLM_PRECOMPILE.call(encoded);
        require(ok, "LLM precompile failed");
        (, bytes memory actualOutput) = abi.decode(rawOutput, (bytes, bytes));
        (bool hasError, bytes memory completionData, , string memory errorMessage, ) = abi.decode(
            actualOutput, (bool, bytes, bytes, string, ConvoHistory)
        );
        if (!hasError) {
            latestThoughtRaw = completionData;
            latestAction = "Action determined by thought";
        } else {
            latestThoughtRaw = abi.encode(errorMessage);
            latestAction = "Error Action";
        }
        return latestThoughtRaw;
    }

    receive() external payable {}
}
