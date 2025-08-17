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
    """Manages the creation and synchronization of Docker-based network topology"""

    def __init__(self, state_file: str = "../public/state.json"):
        self.state_file = state_file
        self.docker_client = None
        self.containers = {}  # Maps node IDs to Docker containers
        self.networks = {}  # Maps network names to Docker networks
        self.state = None
        self.network_name = "llmguard_network"
        self.base_ip = "172.20.0.0/16"

    def load_state(self) -> Dict[str, Any]:
        """Load network state from JSON file"""
        try:
            with open(self.state_file, 'r') as f:
                self.state = json.load(f)
                log_info(
                    f"Loaded network state: {self.state['network']['name']}")
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
        """Get appropriate Docker image and configuration based on node type"""
        configs = {
            'firewall': {
                'image': 'alpine:latest',
                'command': 'sh -c "apk add --no-cache iptables && tail -f /dev/null"',
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
                'command': 'sh -c "apk add --no-cache iproute2 iptables && echo 1 > /proc/sys/net/ipv4/ip_forward && tail -f /dev/null"',
                'cap_add': ['NET_ADMIN'],
                'privileged': True,
                'ports': {}
            },
            'switch': {
                'image': 'alpine:latest',
                'command': 'sh -c "apk add --no-cache bridge-utils iproute2 && tail -f /dev/null"',
                'cap_add': ['NET_ADMIN'],
                'privileged': True,
                'ports': {}
            },
            'user': {
                'image': 'alpine:latest',
                'command': 'sh -c "apk add --no-cache curl wget && tail -f /dev/null"',
                'cap_add': [],
                'privileged': False,
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
        """Create a custom Docker network for the topology"""
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
        """Assign IP address based on node index"""
        # Start from 172.20.0.10 to avoid conflicts with gateway
        ip_host = 10 + node_index
        return f"172.20.0.{ip_host}"

    def create_container(self, node_data: Dict[str, Any], node_index: int) -> Container:
        """Create a Docker container for a network node"""
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
        """Configure services within a container based on node type"""
        node_type = node_data['type']
        node_id = node_data['id']

        try:
            if node_type == 'firewall':
                log_info(f"Configuring firewall rules for {node_id}")
                # Basic firewall configuration
                commands = node_data['config'].get('rules', [])
                for cmd in commands:
                    result = container.exec_run(
                        cmd, user="root")
                    if result.exit_code != 0:
                        log_warn(
                            f"Warning: Command failed in {node_id}: {cmd} with code {result.exit_code}")

            elif node_type == 'router':
                log_info(f"Configuring routing for {node_id}")
                commands = node_data['config'].get('rules', [])
                for cmd in commands:
                    result = container.exec_run(
                        cmd, user="root")
                    if result.exit_code != 0:
                        log_warn(
                            f"Warning: Command failed in {node_id}: {cmd} with code {result.exit_code}")

            elif node_type == 'server':
                log_info(f"Server {node_id} is running nginx by default")
                # Nginx should already be running from the image

        except Exception as e:
            log_error(f"Error configuring services for {node_id}: {e}")

    def create_topology(self) -> None:
        """Create the complete Docker-based network topology"""
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

                # Wait a moment for container to start
                time.sleep(7)

                # Configure services
                self.configure_container_services(container, node_data)

            except Exception as e:
                log_error(
                    f"Failed to create container for {node_data['id']}: {e}")

        log_info("*** Network topology created successfully ***")
        log_info(f"Network: {self.state['network']['name']}")
        log_info(f"Containers: {len(self.containers)}")
        log_info(
            f"Network connections will be simulated through container communication")

    def test_connectivity(self) -> None:
        """Test basic connectivity between containers"""
        log_info("*** Testing connectivity ***")

        if len(self.containers) < 2:
            log_warn("Not enough containers for connectivity test")
            return

        # Get first two containers
        container_ids = list(self.containers.keys())
        container1_id = container_ids[0]
        container2_id = container_ids[1]

        container1 = self.containers[container1_id]
        container2 = self.containers[container2_id]

        try:
            # Get IP of second container
            container2_ip = None
            network_settings = container2.attrs['NetworkSettings']
            for network_name, network_info in network_settings['Networks'].items():
                if network_name == self.network_name:
                    container2_ip = network_info['IPAddress']
                    break

            if container2_ip:
                log_info(
                    f"Testing ping from {container1_id} to {container2_id} ({container2_ip})")

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
        """List all created containers with their details"""
        log_info("*** Container Status ***")

        for node_id, container in self.containers.items():
            try:
                container.reload()  # Refresh container status
                status = container.status

                # Get IP address
                ip_address = "N/A"
                network_settings = container.attrs['NetworkSettings']
                for network_name, network_info in network_settings['Networks'].items():
                    if network_name == self.network_name:
                        ip_address = network_info['IPAddress']
                        break

                log_info(
                    f"Container: {node_id} | Status: {status} | IP: {ip_address}")

            except Exception as e:
                log_error(f"Error getting status for {node_id}: {e}")

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
        """Open an interactive shell in a specific container"""
        if container_id not in self.containers:
            log_error(f"Container {container_id} not found")
            return

        container = self.containers[container_id]
        log_info(f"Opening shell in container: {container_id}")
        log_info(
            "Use 'docker exec -it {container_id} sh' to connect manually")


def main():
    """Main function to run the network initialization"""
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
        # Handle cleanup mode
        if args.cleanup:
            network_manager.init_docker_client()
            network_manager.cleanup()
            return

        # Create the topology
        network_manager.create_topology()

        # List containers if requested
        if args.list:
            network_manager.list_containers()

        # Run connectivity tests if requested
        if args.test:
            network_manager.test_connectivity()

        # Keep containers running
        print("\n" + "="*50)
        print("Network topology is running!")
        print("Use the following commands to interact with containers:")
        print()
        for container_id in network_manager.containers.keys():
            print(f"  docker exec -it {container_id} sh")
        print()
        print("To clean up: python3 init_network.py --cleanup")
        print("To test connectivity: python3 init_network.py --test")
        print("="*50)

    except KeyboardInterrupt:
        print("\n*** Interrupted by user ***")
    except Exception as e:
        print(f"*** Error: {e} ***")
        network_manager.cleanup()


if __name__ == "__main__":
    main()
