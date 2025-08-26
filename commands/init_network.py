#!/usr/bin/env python3
"""
Network Topology Initialization Script using Docker

This script reads the network state from state.json and creates a corresponding
Docker-based network topology with containers and custom networks.

Usage:
    python3 init_network.py [--state-file PATH]

Requirements:
    - Docker
    - Python 3.6+
    - docker Python library
"""

import argparse
import json
import sys
import time
from typing import Any, Dict

import docker
from docker.errors import DockerException, NotFound
from docker.models.containers import Container
from docker.models.networks import Network

from log.logger import log_error, log_info, log_warn


class NetworkTopologyManager:
    """Manages Docker-based network topology creation and synchronization"""

    def __init__(self, state_file: str = "../public/state.json"):
        self.state_file = state_file
        self.docker_client = None
        self.containers = {}  # Maps node IDs to Docker containers
        self.networks = {}  # Maps network names to Docker networks
        self.state = None
        self.network_name = "llmguard_network"
        self.base_ip = "172.20.0.0/16"
        self.connections = {}  # Maps connection IDs to connection data
        self.network_segments = {
            'external': '172.20.1.0/24',
            'dmz': '172.20.2.0/24',
            'internal': '172.20.3.0/24',
            'management': '172.20.4.0/24'
        }
        self.ip_assignments = {}  # Maps node IDs to assigned IPs

    def load_state(self) -> Dict[str, Any]:
        """Load network state from JSON file"""
        try:
            with open(self.state_file, 'r') as f:
                self.state = json.load(f)
                log_info(
                    f"Loaded network state: {self.state['network']['name']}")

                # Load connections
                self.connections = {
                    conn['id']: conn for conn in self.state['network']['connections']}
                log_info(f"Loaded {len(self.connections)} network connections")

                return self.state
        except FileNotFoundError:
            log_error(f"Error: State file {self.state_file} not found")
            sys.exit(1)
        except json.JSONDecodeError as e:
            log_error(f"Error parsing JSON file: {e}")
            sys.exit(1)

    def init_docker_client(self) -> None:
        """Initialize Docker client"""
        try:
            self.docker_client = docker.from_env()
            log_info("Docker client initialized successfully")
            # Test connection
            self.docker_client.ping()
        except DockerException as e:
            log_error(f"Error connecting to Docker: {e}")
            sys.exit(1)

    def get_container_image_and_config(self, node_type: str) -> tuple[str, Dict[str, Any]]:
        """Get Docker image and config for node type"""
        configs = {
            'firewall': {
                'image': 'alpine:latest',
                'command': 'sh -c "apk add --no-cache iptables traceroute && tail -f /dev/null"',
                'cap_add': ['NET_ADMIN'],
                'privileged': True,
                'ports': {}
            },
            'server': {
                'image': 'nginx:alpine',
                'command': None,  # Use default nginx command
                'cap_add': [],
                'privileged': False,
                'ports': {'80/tcp': None, '443/tcp': None}
            },
            'router': {
                'image': 'alpine:latest',
                'command': 'sh -c "apk add --no-cache iproute2 iptables traceroute && echo 1 > /proc/sys/net/ipv4/ip_forward && tail -f /dev/null"',
                'cap_add': ['NET_ADMIN'],
                'privileged': True,
                'ports': {}
            },
            'switch': {
                'image': 'alpine:latest',
                'command': 'sh -c "apk add --no-cache bridge-utils iptables iproute2 && tail -f /dev/null"',
                'cap_add': ['NET_ADMIN'],
                'privileged': True,
                'ports': {}
            },
            'user': {
                'image': 'alpine:latest',
                'command': 'sh -c "sleep 3 && apk add --no-cache iptables && tail -f /dev/null"',
                'cap_add': [],
                'privileged': True,  # TODO: Change to non-privileged
                'ports': {}
            },
            'external': {
                'image': 'alpine:latest',
                'command': 'sh -c "apk add --no-cache iptables iproute2 && tail -f /dev/null"',
                'cap_add': ['NET_ADMIN'],
                'privileged': True,
                'ports': {}
            }
        }

        config = configs.get(node_type, configs['user'])
        return config['image'], config

    def create_custom_network(self) -> Network:
        """Create custom Docker network"""
        try:
            # Remove existing network if it exists
            try:
                existing_network = self.docker_client.networks.get(
                    self.network_name)
                log_info(f"Removing existing network: {self.network_name}")
                existing_network.remove()
            except NotFound:
                pass

            # Create new network
            log_info(f"Creating Docker network: {self.network_name}")
            network = self.docker_client.networks.create(
                name=self.network_name,
                driver="bridge",
                ipam=docker.types.IPAMConfig(
                    pool_configs=[
                        docker.types.IPAMPool(
                            subnet=self.base_ip,
                            gateway="172.20.0.1"
                        )
                    ]
                ),
                options={
                    "com.docker.network.bridge.enable_icc": "true",
                    "com.docker.network.bridge.enable_ip_masquerade": "true"
                }
            )
            self.networks[self.network_name] = network
            return network
        except Exception as e:
            log_error(f"Error creating network: {e}")
            raise

    def assign_ip_address(self, node_id: str, node_index: int) -> str:
        """Assign IP address by node type and segment"""
        node_data = None
        for node in self.state['network']['nodes']:
            if node['id'] == node_id:
                node_data = node
                break

        if not node_data:
            raise ValueError(
                f"Node not found: {node_id}"
            )

        node_type = node_data['type']

        # Assign IPs based on network segments and node type
        if node_type == 'external':
            segment = self.network_segments['external']
            base_ip = int(segment.split('.')[2])
            ip_host = 10 + node_index
            ip = f"172.20.{base_ip}.{ip_host}"
        elif node_type == 'firewall':
            # Firewall gets IP in management segment and acts as gateway
            ip = "172.20.0.2"  # Main gateway
        elif node_type == 'router':
            # Router gets IP in management segment
            ip = "172.20.0.3"
        elif node_type == 'server':
            # Servers in DMZ
            segment = self.network_segments['dmz']
            base_ip = int(segment.split('.')[2])
            ip_host = 10 + (node_index % 240)
            ip = f"172.20.{base_ip}.{ip_host}"
        elif node_type in ['user', 'switch']:
            # Users and switches in internal network
            segment = self.network_segments['internal']
            base_ip = int(segment.split('.')[2])
            ip_host = 10 + (node_index % 240)
            ip = f"172.20.{base_ip}.{ip_host}"
        else:
            # Default assignment
            ip_host = 10 + node_index
            ip = f"172.20.0.{ip_host}"

        self.ip_assignments[node_id] = ip
        return ip

    def create_container(self, node_data: Dict[str, Any], node_index: int) -> Container:
        """Create Docker container for network node"""
        node_id = node_data['id']
        node_type = node_data['type']
        node_name = node_data['name']

        log_info(f"Creating {node_type} container: {node_name} ({node_id})")

        image, config = self.get_container_image_and_config(node_type)

        # Assign IP address
        ip_address = self.assign_ip_address(node_id, node_index)

        try:
            # Remove existing container if it exists
            try:
                existing_container = self.docker_client.containers.get(node_id)
                log_info(f"Removing existing container: {node_id}")
                existing_container.stop()
                existing_container.remove()
            except NotFound:
                pass

            # Create container
            container_kwargs = {
                'image': image,
                'name': node_id,
                'detach': True,
                'environment': {
                    'NODE_TYPE': node_type,
                    'NODE_NAME': node_name,
                    'NODE_ID': node_id
                },
                'labels': {
                    'llmguard.node_type': node_type,
                    'llmguard.node_name': node_name,
                    'llmguard.network': self.network_name
                },
                'network': self.network_name,
                'hostname': node_id
            }

            # Add type-specific configurations
            if config['command']:
                container_kwargs['command'] = config['command']

            if config['cap_add']:
                container_kwargs['cap_add'] = config['cap_add']

            if config['privileged']:
                container_kwargs['privileged'] = config['privileged']

            if config['ports']:
                container_kwargs['ports'] = config['ports']

            container = self.docker_client.containers.run(**container_kwargs)

            # Set static IP address
            network = self.networks[self.network_name]
            network.disconnect(container)
            network.connect(container, ipv4_address=ip_address)

            log_info(f"Container {node_id} created with IP {ip_address}")

            return container

        except Exception as e:
            log_error(f"Error creating container {node_id}: {e}")
            raise

    def configure_container_services(self, container: Container, node_data: Dict[str, Any]) -> None:
        """Configure services by node type"""
        node_type = node_data['type']
        node_id = node_data['id']

        try:
            if node_type == 'firewall':
                log_info(f"Configuring firewall rules for {node_id}")
                self.configure_firewall_rules(container, node_data)

            elif node_type == 'router':
                log_info(f"Configuring routing for {node_id}")
                self.configure_router_rules(container, node_data)

            elif node_type in ['user', 'switch']:
                log_info(
                    f"Configuring network rules for {node_type} {node_id}")
                self.configure_host_rules(container, node_data)

        except Exception as e:
            log_error(f"Error configuring services for {node_id}: {e}")

    def configure_firewall_rules(self, container: Container, node_data: Dict[str, Any]) -> None:
        node_id = node_data['id']
        router_ip = self.get_router_ip()

        setup_commands = [
            "iptables -F",
            "iptables -X",
            "iptables -t nat -F",
            "iptables -t nat -X",
            "iptables -P INPUT DROP",
            "iptables -P OUTPUT DROP",
            "iptables -P FORWARD DROP",
            "echo 1 > /proc/sys/net/ipv4/ip_forward",
            "iptables -A INPUT -i lo -j ACCEPT",
            "iptables -A OUTPUT -o lo -j ACCEPT",
            "iptables -A INPUT  -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
            "iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
            "iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
        ]

        user_containers = []
        for node in self.state['network']['nodes']:
            if node['type'] == 'user':
                user_containers.append(node['id'])

        for source_user in user_containers:
            source_ip = self.ip_assignments.get(source_user)
            if source_ip:
                for target_user in user_containers:
                    if source_user != target_user:
                        target_ip = self.ip_assignments.get(target_user)
                        if target_ip:
                            cmd = f"iptables -A FORWARD -s {source_ip} -d {target_ip} -j ACCEPT"
                            setup_commands.append(cmd)

        for cmd in setup_commands:
            self.execute_command_with_retry(container, cmd, node_id)

    def configure_host_rules(self, container: Container, node_data: Dict[str, Any]) -> None:
        node_id = node_data['id']
        router_ip = self.get_router_ip()
        firewall_ip = self.get_firewall_ip()

        setup_commands = [
            "iptables -F",
            "iptables -X",
            "iptables -t nat -F",
            "iptables -t nat -X",
            "iptables -P INPUT DROP",
            "iptables -P OUTPUT DROP",
            "iptables -P FORWARD DROP",
            "iptables -A INPUT -i lo -j ACCEPT",
            "iptables -A OUTPUT -o lo -j ACCEPT",
            "iptables -A INPUT  -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
            "iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
            "iptables -A INPUT  -p icmp -j ACCEPT",
            "iptables -A OUTPUT -p icmp -j ACCEPT",
            f"iptables -A OUTPUT -d {router_ip} -j ACCEPT",
            f"iptables -A INPUT -s {firewall_ip} -j ACCEPT",
            "ip route del default",
            f"ip route add default via {router_ip}",
            f"ip route replace 172.20.3.0/24 via {router_ip}"
        ]

        for cmd in setup_commands:
            self.execute_command_with_retry(container, cmd, node_id)

    def configure_router_rules(self, container: Container, node_data: Dict[str, Any]) -> None:
        node_id = node_data['id']
        firewall_ip = self.get_firewall_ip()

        setup_commands = [
            "iptables -F",
            "iptables -X",
            "iptables -t nat -F",
            "iptables -t nat -X",
            "iptables -P INPUT DROP",
            "iptables -P OUTPUT ACCEPT",
            "iptables -P FORWARD DROP",
            "echo 1 > /proc/sys/net/ipv4/ip_forward",
            "iptables -A INPUT -i lo -j ACCEPT",
            "iptables -A OUTPUT -o lo -j ACCEPT",
            "iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
            "iptables -A INPUT -p icmp -j ACCEPT",
            "iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
            "iptables -A FORWARD -s 172.20.3.0/24 -d 172.20.3.0/24 -p icmp -j ACCEPT",
            "iptables -A FORWARD -s 172.20.3.0/24 -d 172.20.3.0/24 -j ACCEPT",
            f"ip route replace 172.20.3.0/24 via {firewall_ip}"
        ]

        for cmd in setup_commands:
            self.execute_command_with_retry(container, cmd, node_id)

    def get_node_connections(self, node_id: str) -> list:
        """Get all connections for a node"""
        connections = []
        for conn_id, conn_data in self.connections.items():
            if conn_data['source'] == node_id or conn_data['target'] == node_id:
                connections.append(conn_data)
        return connections

    def get_firewall_ip(self) -> str:
        """Get firewall IP address"""
        for node_id, ip in self.ip_assignments.items():
            if node_id.startswith('fw-'):
                return ip
        return None

    def get_router_ip(self) -> str:
        """Get router IP address"""
        for node_id, ip in self.ip_assignments.items():
            if node_id.startswith('rt-'):
                return ip
        return None

    def add_firewall_connection_rule(self, container: Container, conn_data: Dict[str, Any], node_id: str) -> None:
        """Add firewall rules for allowed connections"""
        source_ip = self.ip_assignments.get(conn_data['source'])
        target_ip = self.ip_assignments.get(conn_data['target'])
        log_info(
            f"Creating firewall rule for connection {conn_data['id']}: {source_ip} <-> {target_ip}")
        if not source_ip or not target_ip:
            log_warn(
                f"Cannot create rule for connection {conn_data['id']}: missing IP assignments")
            return

        # Allow traffic between connected nodes
        if conn_data['source'] == node_id:
            # Outgoing traffic
            cmd = f"iptables -A OUTPUT -d {target_ip} -j ACCEPT"
            self.execute_command_with_retry(container, cmd, node_id)
            cmd = f"iptables -A FORWARD -s {source_ip} -d {target_ip} -j ACCEPT"
            self.execute_command_with_retry(container, cmd, node_id)
        elif conn_data['target'] == node_id:
            # Incoming traffic
            cmd = f"iptables -A INPUT -s {source_ip} -j ACCEPT"
            self.execute_command_with_retry(container, cmd, node_id)
            cmd = f"iptables -A FORWARD -s {source_ip} -d {target_ip} -j ACCEPT"
            self.execute_command_with_retry(container, cmd, node_id)

    def add_connection_rules(self) -> None:
        """Add connection rules to all containers"""
        log_info("Applying bidirectional connection rules...")
        for conn_id, conn_data in self.connections.items():
            if conn_data.get('status') == 'active':
                source_id = conn_data['source']
                target_id = conn_data['target']
                source_ip = self.ip_assignments.get(source_id)
                target_ip = self.ip_assignments.get(target_id)

                if not source_ip or not target_ip:
                    log_warn(
                        f"Skipping connection {conn_id}: missing IP assignments")
                    continue

                log_info(
                    f"Applying bidirectional rules for connection {conn_id}: {source_id} <-> {target_id}")

                # Apply rules to source container
                if source_id in self.containers:
                    source_container = self.containers[source_id]
                    # Allow outgoing to target
                    cmd = f"iptables -I OUTPUT 1 -d {target_ip} -j ACCEPT"
                    self.execute_command_with_retry(
                        source_container, cmd, source_id)
                    # Allow incoming from target
                    cmd = f"iptables -I INPUT 1 -s {target_ip} -j ACCEPT"
                    self.execute_command_with_retry(
                        source_container, cmd, source_id)

                # Apply rules to target container
                if target_id in self.containers:
                    target_container = self.containers[target_id]
                    # Allow outgoing to source
                    cmd = f"iptables -I OUTPUT 1 -d {source_ip} -j ACCEPT"
                    self.execute_command_with_retry(
                        target_container, cmd, target_id)
                    # Allow incoming from source
                    cmd = f"iptables -I INPUT 1 -s {source_ip} -j ACCEPT"
                    self.execute_command_with_retry(
                        target_container, cmd, target_id)

    def execute_command_with_retry(self, container: Container, cmd: str, node_id: str, max_retries: int = 5) -> bool:
        """Execute command with retry logic"""
        for attempt in range(max_retries):
            try:
                result = container.exec_run(cmd, user="root", privileged=True)
                if result.exit_code == 0:
                    log_info(
                        f"Successfully executed command in {node_id}: {cmd}")
                    return True
                else:
                    log_warn(
                        f"Attempt {attempt + 1} failed for {node_id}: {cmd} with code {result.exit_code}")
                    if attempt < max_retries - 1:
                        time.sleep(10)
            except Exception as e:
                log_warn(
                    f"Exception on attempt {attempt + 1} for {node_id}: {e}")
                if attempt < max_retries - 1:
                    time.sleep(10)

        log_error(
            f"Command failed after {max_retries} attempts in {node_id}: {cmd}")
        return False

    def create_topology(self) -> None:
        """Create complete Docker network topology"""
        if not self.state:
            self.load_state()

        log_info("*** Creating Docker-based network topology ***")

        # Initialize Docker client
        self.init_docker_client()

        # Create custom network
        self.create_custom_network()

        # Create all containers
        log_info("Creating network containers...")
        nodes = self.state['network']['nodes']

        for index, node_data in enumerate(nodes):
            try:
                container = self.create_container(node_data, index)
                self.containers[node_data['id']] = container

            except Exception as e:
                log_error(
                    f"Failed to create container for {node_data['id']}: {e}")

        # Wait a moment for containers to start
        time.sleep(15)

        # Configure services
        for container, node_data in zip(self.containers.values(), nodes):
            self.configure_container_services(container, node_data)

        # Apply connection-based network policies
        log_info("Applying connection-based network policies...")
        self.add_connection_rules()

        log_info("*** Network topology created successfully ***")
        log_info(f"Network: {self.state['network']['name']}")
        log_info(f"Containers: {len(self.containers)}")
        log_info(f"Connections: {len(self.connections)}")
        log_info("Network traffic is controlled by connection definitions")

    def validate_connections(self) -> None:
        """Validate defined connections are allowed"""
        log_info("Validating connection restrictions...")

        # Test each defined connection
        for conn_id, conn_data in self.connections.items():
            if conn_data['status'] == 'active':
                self.test_connection(conn_data)

    def test_connection(self, conn_data: Dict[str, Any]) -> None:
        """Test that a defined connection works"""
        source_id = conn_data['source']
        target_id = conn_data['target']

        if source_id not in self.containers or target_id not in self.containers:
            log_warn(
                f"Cannot test connection {conn_data['id']}: containers not found")
            return

        source_container = self.containers[source_id]
        target_ip = self.ip_assignments.get(target_id)

        if not target_ip:
            log_warn(
                f"Cannot test connection {conn_data['id']}: target IP not found")
            return

        try:
            # Install ping if not available
            source_container.exec_run(
                "apk add --no-cache iputils", detach=False)

            # Test connectivity
            result = source_container.exec_run(
                f"ping -c 1 -W 3 {target_ip}", detach=False)
            if result.exit_code == 0:
                log_info(
                    f"✓ Connection {conn_data['id']} ({source_id} -> {target_id}) working")
            else:
                log_error(
                    f"✗ Connection {conn_data['id']} ({source_id} -> {target_id}) failed")

        except Exception as e:
            log_error(f"Error testing connection {conn_data['id']}: {e}")

    def test_connectivity(self) -> None:
        """Test basic connectivity between containers"""
        log_info("*** Testing connectivity ***")

        if len(self.docker_client.containers.list()) < 2:
            log_warn("Not enough containers for connectivity test")
            return

        # Get first two containers
        container_ids = list(self.docker_client.containers.list())
        container1 = container_ids[0]
        container2 = container_ids[1]

        try:
            # Get IP of first container
            container1_ip = None
            network_settings = container1.attrs['NetworkSettings']
            for network_name, network_info in network_settings['Networks'].items():
                if network_name == self.network_name:
                    container1_ip = network_info['IPAddress']
                    break

            # Get IP of second container
            container2_ip = None
            network_settings = container2.attrs['NetworkSettings']
            for network_name, network_info in network_settings['Networks'].items():
                if network_name == self.network_name:
                    container2_ip = network_info['IPAddress']
                    break
            if container1_ip and container2_ip:
                log_info(
                    f"Testing ping from {container1.id} ({container1_ip}) to {container2.id} ({container2_ip})")

                # Install ping if not available
                container1.exec_run("apk add --no-cache iputils", detach=False)

                # Ping test
                result = container1.exec_run(
                    f"ping -c 3 {container2_ip}", detach=False)
                if result.exit_code == 0:
                    log_info("Ping test successful!")
                else:
                    log_error(f"Ping test failed: {result.output.decode()}")
            else:
                log_warn("Could not determine target IP address")

        except Exception as e:
            log_error(f"Error during connectivity test: {e}")

    def list_containers(self) -> None:
        """List all containers with their details"""
        log_info("*** Container Status ***")

        for node_id, container in self.containers.items():
            try:
                container.reload()  # Refresh container status
                status = container.status

                # Get IP address
                ip_address = self.ip_assignments.get(node_id, "N/A")

                log_info(
                    f"Container: {node_id} | Status: {status} | IP: {ip_address}")

            except Exception as e:
                log_error(f"Error getting status for {node_id}: {e}")

        # Display connection topology
        log_info("\n*** Network Connection Topology ***")
        for conn_id, conn_data in self.connections.items():
            source_ip = self.ip_assignments.get(conn_data['source'], 'N/A')
            target_ip = self.ip_assignments.get(conn_data['target'], 'N/A')
            log_info(f"Connection: {conn_id}")
            log_info(
                f"  {conn_data['source']} ({source_ip}) -> {conn_data['target']} ({target_ip})")
            log_info(
                f"  Type: {conn_data['type']} | Status: {conn_data['status']} | Bandwidth: {conn_data.get('bandwidth', 'N/A')}")
            log_info("")

    def cleanup(self) -> None:
        """Clean up containers and networks"""
        log_info("*** Cleaning up resources ***")

        # Stop and remove containers
        for container in self.docker_client.containers.list(all=True):
            try:
                log_info(f"Stopping container: {container.name}")
                container.stop(timeout=5)
                container.remove()
            except Exception as e:
                log_error(f"Error cleaning up container {container.name}: {e}")

        # Remove networks
        for network_name, network in self.networks.items():
            try:
                log_info(f"Removing network: {network_name}")
                network.remove()
            except Exception as e:
                log_error(f"Error removing network {network_name}: {e}")

        log_info("Cleanup completed")

    def interactive_shell(self, container_id: str) -> None:
        """Open interactive shell in container"""
        if container_id not in self.containers:
            log_error(f"Container {container_id} not found")
            return

        container = self.containers[container_id]
        log_info(f"Opening shell in container: {container_id}")
        log_info(
            "Use 'docker exec -it {container_id} sh' to connect manually")


def main():
    """Main function to run network initialization"""
    parser = argparse.ArgumentParser(
        description='Initialize Docker-based network topology from state file')
    parser.add_argument('--state-file',
                        default='../public/state.json',
                        help='Path to the network state JSON file')
    parser.add_argument('--test',
                        action='store_true',
                        help='Run connectivity tests after creation')
    parser.add_argument('--cleanup',
                        action='store_true',
                        help='Clean up existing containers and networks')
    parser.add_argument('--list',
                        action='store_true',
                        help='List container status and exit')

    args = parser.parse_args()

    # Create network manager
    network_manager = NetworkTopologyManager(args.state_file)

    try:
        network_manager.init_docker_client()

        if args.cleanup:
            network_manager.cleanup()
            return

        if args.list:
            network_manager.list_containers()
            return

        if args.test:
            network_manager.test_connectivity()
            network_manager.validate_connections()
            return

        # Create the topology
        network_manager.create_topology()

        # Keep containers running
        log_info("="*50)
        log_info("Network topology with connection-based security is running!")
        log_info("="*50)
        log_info("Container Access Commands:")
        for container_id in network_manager.containers.keys():
            log_info(f"  docker exec -it {container_id} sh")
        log_info("")
        log_info("Network Information:")
        log_info(f"  Total Containers: {len(network_manager.containers)}")
        log_info(f"  Defined Connections: {len(network_manager.connections)}")
        log_info(
            f"  Network Segments: {len(network_manager.network_segments)}")
        log_info("")
        log_info("Available Commands:")
        log_info("  python3 init_network.py --cleanup     # Clean up resources")
        log_info("  python3 init_network.py --test        # Test connectivity")
        log_info("  python3 init_network.py --list        # List containers")
        log_info("="*50)

    except KeyboardInterrupt:
        log_error("\n*** Interrupted by user ***")
        network_manager.cleanup()
    except Exception as e:
        log_error(f"*** Error: {e} ***")
        network_manager.cleanup()


if __name__ == "__main__":
    main()
