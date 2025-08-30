# LLMGuard

A sophisticated network security management platform that enables natural language control of virtual network topologies. LLMGuard combines the power of Docker containerization, intelligent AI-driven command processing, and intuitive web visualization to create a safe, interactive environment for network security experimentation and education.

## 🚀 Features

### AI-Powered Network Management

-   **Natural Language Interface**: Control complex network configurations using plain English commands
-   **Intelligent Command Translation**: Automatically converts natural language requests into precise iptables/nftables rules
-   **Context-Aware Processing**: Maintains conversation history for coherent, multi-step network configurations

### Interactive Network Visualization

-   **Real-Time Topology Visualization**: Dynamic network diagrams showing nodes, connections, and traffic flow
-   **Interactive Node Management**: Drag-and-drop interface for network topology manipulation
-   **Live Status Monitoring**: Real-time updates of network state and security rule changes

### Containerized Network Simulation

-   **Docker-Based Infrastructure**: Isolated, reproducible network environments
-   **Multi-Container Topologies**: Support for complex network architectures with firewalls, routers, and endpoints
-   **Safe Sandbox Environment**: Risk-free experimentation without affecting production systems

### Comprehensive Security Testing

-   **Automated Rule Validation**: Test and verify security configurations before deployment
-   **Traffic Flow Analysis**: Monitor and analyze network traffic patterns
-   **Security Policy Enforcement**: Implement and test various security policies and rules

## 🛠 Technology Stack

### Frontend

-   **Next.js 15** - Modern React framework with server-side rendering
-   **TypeScript** - Type-safe development experience
-   **Tailwind CSS** - Utility-first CSS framework
-   **React Flow** - Interactive network topology visualization
-   **Framer Motion** - Smooth animations and transitions

### Backend & AI

-   **Ollama** - Local LLM integration for natural language processing
-   **Python 3.12** - Network automation and Docker orchestration
-   **Docker** - Containerized network simulation environment
-   **iptables/nftables** - Linux firewall rule management

## 📋 Prerequisites

Before installing LLMGuard, ensure you have the following installed:

-   **Node.js** (v18 or higher)
-   **Python** (v3.8 or higher)
-   **Docker** (v20.10 or higher)
-   **Ollama** (for AI functionality)

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/FamALouiz/LLMGuard.git
cd LLMGuard
```

### 2. Install Dependencies

#### Frontend Dependencies

```bash
npm install
```

#### Python Dependencies

```bash
pip install -r requirements.txt
```

### 3. Set Up Ollama

```bash
# Install and start Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve

# Pull a compatible model (recommended)
ollama pull qwen3:4b
```

### 4. Configure Docker

Ensure Docker daemon is running and your user has Docker permissions:

```bash
docker --version
docker ps
```

## 🚀 Quick Start

### 1. Start the Development Server

```bash
npm run dev
```

### 2. Initialize Network Topology

```bash
python3 commands/init_network.py --state-file ./public/simplified_state.json
```

### 3. Access the Application

Open your browser and navigate to `http://localhost:3000`

### 4. Start Managing Networks

-   Use the chat interface to give natural language commands
-   Interact with the network topology visualization
-   Monitor real-time changes and logs

## 💬 Example Commands

LLMGuard understands natural language commands for network management:

```
"Block all traffic from 192.168.1.0/24 to the web server"
"Allow SSH access only from the admin subnet"
"Create a DMZ for the web servers with limited access"
"Show me the current firewall rules"
"Test connectivity between nodes A and B"
```

## 📁 Project Structure

```
LLMGuard/
├── app/                    # Next.js application
│   ├── api/               # API routes
│   │   ├── chat/          # Chat interface API
│   │   ├── execute-command/ # Command execution
│   │   └── network-state/ # Network state management
│   ├── components/        # React components
│   └── globals.css        # Global styles
├── commands/              # Python network management scripts
│   ├── init_network.py    # Network initialization
│   └── log/              # Logging utilities
├── data/                  # Configuration and keywords
├── public/                # Static assets
└── scripts/              # Utility scripts
```

## 🧪 Development

### Code Linting

```bash
# Frontend linting
npm run lint

# Python linting
flake8 commands/
```

### Building for Production

```bash
npm run build
npm start
```

## 📖 Documentation

### API Endpoints

-   `POST /api/chat` - Natural language command processing
-   `POST /api/execute-command` - Direct command execution
-   `GET /api/network-state` - Current network topology state
-   `PUT /api/update-node-position` - Update node positions in topology

### Configuration Files

-   `next.config.ts` - Next.js configuration
-   `requirements.txt` - Python dependencies
-   `data/keywords.ts` - Command keywords and patterns

## 🔒 Security Considerations

-   **Sandboxed Environment**: All network operations run in isolated Docker containers
-   **Input Validation**: All commands are validated before execution
-   **Access Control**: Network access is restricted to defined topologies
-   **Audit Logging**: All operations are logged for security analysis

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch
5. Open a Pull Request

### Development Guidelines

-   Follow TypeScript best practices
-   Write comprehensive tests
-   Update documentation for new features
-   Ensure Docker compatibility

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Contributors

-   **Fam Shihata** - @FamALouiz (fam@awadlouis.com)
