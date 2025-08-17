import datetime
import sys
from enum import Enum
from typing import Optional


class LogLevel(Enum):
    """Enumeration for log levels."""
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"


class Colors:
    """ANSI color codes for terminal output."""
    # Colors
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'

    # Styles
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

    # Reset
    RESET = '\033[0m'


class Logger:
    """
    A simple logger class with colored output and multiple log levels.

    Supports INFO, WARN, and ERROR levels with color-coded output.
    Provides both instance methods and static methods for convenience.
    """

    _instance: Optional['Logger'] = None

    def __init__(self, name: str = "Logger", show_timestamp: bool = True):
        """
        Initialize the logger.

        Args:
            name: The name of the logger
            show_timestamp: Whether to show timestamps in log messages
        """
        self.name = name
        self.show_timestamp = show_timestamp
        self._level_colors = {
            LogLevel.INFO: Colors.BLUE,
            LogLevel.WARN: Colors.YELLOW,
            LogLevel.ERROR: Colors.RED
        }
        self._level_symbols = {
            LogLevel.INFO: "[i]",
            LogLevel.WARN: "[⚠]",
            LogLevel.ERROR: "[✗]"
        }

    def _format_timestamp(self) -> str:
        """Get formatted timestamp string."""
        if not self.show_timestamp:
            return ""
        return f"{Colors.CYAN}[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}]{Colors.RESET} "

    def _format_level(self, level: LogLevel) -> str:
        """Format the log level with color and symbol."""
        color = self._level_colors[level]
        symbol = self._level_symbols[level]
        return f"{color}{Colors.BOLD}[{symbol} {level.value}]{Colors.RESET}"

    def _format_logger_name(self) -> str:
        """Format the logger name."""
        return f"{Colors.PURPLE}[{self.name}]{Colors.RESET} "

    def _log(self, level: LogLevel, message: str, *args) -> None:
        """
        Internal logging method.

        Args:
            level: The log level
            message: The message to log
            *args: Additional arguments to format into the message
        """
        # Format the message with any additional arguments
        if args:
            try:
                formatted_message = message % args
            except (TypeError, ValueError):
                formatted_message = f"{message} {' '.join(str(arg) for arg in args)}"
        else:
            formatted_message = message

        # Build the complete log message
        timestamp = self._format_timestamp()
        level_str = self._format_level(level)
        logger_name = self._format_logger_name()

        # Color the actual message based on level
        message_color = self._level_colors[level]
        colored_message = f"{message_color}{formatted_message}{Colors.RESET}"

        # Combine all parts
        full_message = f"{timestamp}{level_str} {logger_name}{colored_message}"

        # Print to appropriate stream
        output_stream = sys.stderr if level == LogLevel.ERROR else sys.stdout
        print(full_message, file=output_stream)

    def info(self, message: str, *args) -> None:
        """
        Log an info message.

        Args:
            message: The message to log
            *args: Additional arguments to format into the message
        """
        self._log(LogLevel.INFO, message, *args)

    def warn(self, message: str, *args) -> None:
        """
        Log a warning message.

        Args:
            message: The message to log
            *args: Additional arguments to format into the message
        """
        self._log(LogLevel.WARN, message, *args)

    def error(self, message: str, *args) -> None:
        """
        Log an error message.

        Args:
            message: The message to log
            *args: Additional arguments to format into the message
        """
        self._log(LogLevel.ERROR, message, *args)

    @classmethod
    def get_instance(cls, name: str = "Logger", show_timestamp: bool = True) -> 'Logger':
        """
        Get or create the singleton logger instance.

        Args:
            name: The name of the logger (only used for first creation)
            show_timestamp: Whether to show timestamps (only used for first creation)

        Returns:
            The logger instance
        """
        if cls._instance is None:
            cls._instance = cls(name, show_timestamp)
        return cls._instance

    @staticmethod
    def log_info(message: str, *args) -> None:
        """
        Static method to log an info message.

        Args:
            message: The message to log
            *args: Additional arguments to format into the message
        """
        Logger.get_instance().info(message, *args)

    @staticmethod
    def log_warn(message: str, *args) -> None:
        """
        Static method to log a warning message.

        Args:
            message: The message to log
            *args: Additional arguments to format into the message
        """
        Logger.get_instance().warn(message, *args)

    @staticmethod
    def log_error(message: str, *args) -> None:
        """
        Static method to log an error message.

        Args:
            message: The message to log
            *args: Additional arguments to format into the message
        """
        Logger.get_instance().error(message, *args)


def log_info(message: str, *args) -> None:
    """Quick function to log an info message."""
    Logger.log_info(message, *args)


def log_warn(message: str, *args) -> None:
    """Quick function to log a warning message."""
    Logger.log_warn(message, *args)


def log_error(message: str, *args) -> None:
    """Quick function to log an error message."""
    Logger.log_error(message, *args)
