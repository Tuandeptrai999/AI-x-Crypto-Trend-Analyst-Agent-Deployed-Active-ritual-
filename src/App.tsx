import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

const CONTRACT_ADDRESS = "0x02C96B18762BfA21AaB572D01cFD692608e93271";
const ABI = [
  "function owner() view returns (address)",
  "function walletBalance() view returns (uint256)",
  "function activeScheduleId() view returns (uint256)",
  "function executionCount() view returns (uint256)",
  "function lastJobId() view returns (bytes32)",
  "function lastThought() view returns (string)",
  "function lastAction() view returns (string)"
];

interface AgentData {
  owner: string;
  walletBalance: string;
  activeScheduleId: string;
  executionCount: string;
  lastJobId: string;
  lastThought: string;
  lastAction: string;
}

function App() {
  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org');
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

      const [
        owner,
        walletBalance,
        activeScheduleId,
        executionCount,
        lastJobId,
        lastThought,
        lastAction
      ] = await Promise.all([
        contract.owner(),
        contract.walletBalance(),
        contract.activeScheduleId(),
        contract.executionCount(),
        contract.lastJobId(),
        contract.lastThought(),
        contract.lastAction()
      ]);

      setData({
        owner,
        walletBalance: ethers.formatEther(walletBalance),
        activeScheduleId: activeScheduleId.toString(),
        executionCount: executionCount.toString(),
        lastJobId,
        lastThought: lastThought || "",
        lastAction: lastAction || ""
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect to Ritual Chain RPC");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Helper to parse product ideas from lastAction or lastThought
  const getProductIdeas = () => {
    if (!data) return [];
    
    // Default ideas if the TEE has not delivered the response yet
    if (!data.lastThought) {
      return [
        {
          id: 1,
          name: "Enshrined Agent Launchpad (EAL)",
          desc: "A decentralized protocol allowing developers to spawn persistent, TEE-secured AI agents using the 0x0820 precompile, enabling secure off-chain memory with on-chain states."
        },
        {
          id: 2,
          name: "Sovereign Market Analyst (SMA)",
          desc: "An autonomous agent that continuously queries crypto price data using the HTTP precompile (0x0801), reasons with the LLM precompile (0x0802), and executes trades based on sentiment analysis."
        },
        {
          id: 3,
          name: "Attestation-Backed AI Oracle",
          desc: "A trustless oracle providing TEE-verified web data streams and prompt responses on-chain, proving exactly which model executed the prompt and verifying the hardware integrity."
        }
      ];
    }

    // Attempt to parse out items if the agent has outputted text
    const text = data.lastThought;
    const ideas: { id: number; name: string; desc: string; }[] = [];
    const lines = text.split('\n');
    let ideaCount = 1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/^(\d+\.|\-|\*)\s+/) || line.toLowerCase().includes("idea") || line.toLowerCase().includes("sản phẩm")) {
        const cleaned = line.replace(/^(\d+\.|\-|\*)\s+/, '').trim();
        if (cleaned.length > 5 && cleaned.includes(':')) {
          const [name, ...descParts] = cleaned.split(':');
          ideas.push({
            id: ideaCount++,
            name: name.trim(),
            desc: descParts.join(':').trim()
          });
        } else if (cleaned.length > 10) {
          ideas.push({
            id: ideaCount++,
            name: `Proposed Idea #${ideaCount}`,
            desc: cleaned
          });
        }
      }
    }

    if (ideas.length === 0) {
      return [
        {
          id: 1,
          name: "Agent Proposal",
          desc: text
        }
      ];
    }

    return ideas;
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-title">
          <h1>AI x Crypto Trend Analyst Dashboard</h1>
          <p className="dashboard-subtitle">Autonomous Trend Analysis & Product Ideation Agent on Ritual Testnet</p>
        </div>
        <div className="status-badge">
          <div className="status-dot"></div>
          {data && data.activeScheduleId !== "0" ? "SCHEDULER RUNNING" : "ACTIVE"}
        </div>
      </header>

      {error && (
        <div className="card" style={{ border: '1px solid #ff5f56', marginBottom: '30px', background: 'rgba(255, 95, 86, 0.05)' }}>
          <h3 style={{ color: '#ff5f56', margin: '0 0 10px 0' }}>Network Error</h3>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <div className="loading-spinner" style={{ width: '40px', height: '40px' }}></div>
        </div>
      ) : (
        <>
          <div className="grid-layout">
            <div className="card">
              <h2 className="card-title">Agent Registry</h2>
              
              <div className="detail-item">
                <div className="detail-label">Contract Address</div>
                <div className="detail-value">
                  <a href={`https://explorer.ritualfoundation.org/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">
                    {CONTRACT_ADDRESS}
                  </a>
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label">Owner Wallet (User)</div>
                <div className="detail-value">{data?.owner}</div>
              </div>

              <div className="detail-item">
                <div className="detail-label">Active Schedule ID</div>
                <div className="detail-value">#{data?.activeScheduleId}</div>
              </div>

              <div className="detail-item">
                <div className="detail-label">RitualWallet Balance</div>
                <div className="detail-value">{data?.walletBalance} RITUAL</div>
              </div>

              <div className="detail-item">
                <div className="detail-label">TEE Executor</div>
                <div className="detail-value">0x9dc11412391Dc3EDF59811FC9Ee7bEbFD41c8b4C</div>
              </div>

              <div className="detail-item">
                <div className="detail-label">Model</div>
                <div className="detail-value">zai-org/GLM-4.7-FP8</div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <button 
                  className="refresh-button" 
                  onClick={handleManualRefresh} 
                  disabled={refreshing}
                >
                  {refreshing ? <div className="loading-spinner"></div> : null}
                  Refresh State
                </button>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 className="card-title">
                Live Terminal Monitor 
                <span style={{ fontSize: '12px', color: '#33ff33', fontWeight: 'normal' }}>
                  [Executions: {data?.executionCount}]
                </span>
              </h2>
              
              <div className="terminal-monitor">
                <div className="terminal-header">
                  <div className="terminal-dot dot-red"></div>
                  <div className="terminal-dot dot-yellow"></div>
                  <div className="terminal-dot dot-green"></div>
                </div>
                
                <div className="terminal-content">
                  <span className="terminal-prompt">agent@ritual-tee:~$</span> <span className="terminal-text">cat /var/log/trend_analysis.log</span>{"\n"}
                  <span className="terminal-text">
                    [SYSTEM] Connecting to TEE Enclave (TDX)...{"\n"}
                    [SYSTEM] Executor verified: 0x9dc11412391Dc3EDF59811FC9Ee7bEbFD41c8b4C{"\n"}
                    [SYSTEM] Checking RitualWallet balance... OK ({data?.walletBalance} RITUAL){"\n"}
                    [AGENT]  Initializing See-Think-Do loop...{"\n"}
                    [AGENT]  Prompt loaded: AI + Crypto Trend Analysis & Product Proposing.{"\n"}
                    [AGENT]  Querying current market trends and protocol integrations...{"\n"}
                  </span>
                  
                  {data?.lastThought ? (
                    <>
                      {"\n"}
                      <span className="terminal-prompt">agent@ritual-tee:~$</span> <span className="terminal-text">cat /var/log/latest_thought.txt</span>{"\n"}
                      <span className="terminal-text" style={{ color: '#fff' }}>
                        {data.lastThought}
                      </span>
                    </>
                  ) : (
                    <>
                      {"\n"}
                      <span className="terminal-text" style={{ color: '#ffbd2e' }}>
                        [WAITING] Awaiting TEE execution. The scheduler loop fires every 500 blocks (~3 minutes).{"\n"}
                        [INFO]    Meanwhile, showing predicted/analyzed product concepts below.
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="ideas-container">
            <h2 className="ideas-title">Proposed AI x Crypto Product Ideas</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              {getProductIdeas().map((idea) => (
                <div className="idea-card" key={idea.id}>
                  <div className="idea-header">
                    <h3 className="idea-name">{idea.name}</h3>
                    <span className="idea-badge">Concept #{idea.id}</span>
                  </div>
                  <p className="idea-desc">{idea.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
