import sys
from pathlib import Path

# Make project root importable in all tests without manual sys.path in each file.
sys.path.insert(0, str(Path(__file__).parent))
