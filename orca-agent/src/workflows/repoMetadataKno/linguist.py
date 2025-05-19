import os
from pygments.lexers import guess_lexer_for_filename
from pygments.util import ClassNotFound
from collections import defaultdict

class Linguist:
    def __init__(self):
        self.language_stats = defaultdict(int)
        self.total_bytes = 0
    
    def _is_binary(self, filepath):
        """Check if a file is binary."""
        try:
            with open(filepath, 'tr') as check_file:
                check_file.read()
                return False
        except UnicodeDecodeError:
            return True
    
    def _should_analyze(self, filepath):
        """Determine if a file should be analyzed."""
        # Skip hidden files and directories
        if any(part.startswith('.') for part in filepath.split(os.sep)):
            return False
            
        # Skip common binary file extensions
        binary_extensions = {'.pyc', '.so', '.dll', '.exe', '.bin'}
        if os.path.splitext(filepath)[1].lower() in binary_extensions:
            return False
            
        # Skip binary files
        if self._is_binary(filepath):
            return False
            
        return True
    
    def analyze_project(self, project_path):
        """Analyze a project directory and return language statistics."""
        for root, _, files in os.walk(project_path):
            for file in files:
                filepath = os.path.join(root, file)
                
                if not self._should_analyze(filepath):
                    continue
                    
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        file_size = len(content.encode('utf-8'))
                        
                        try:
                            lexer = guess_lexer_for_filename(filepath, content)
                            self.language_stats[lexer.name] += file_size
                            self.total_bytes += file_size
                        except ClassNotFound:
                            continue
                except (IOError, UnicodeDecodeError):
                    continue
        
        # Convert byte counts to percentages
        if self.total_bytes > 0:
            return {
                lang: (bytes_count / self.total_bytes) * 100
                for lang, bytes_count in self.language_stats.items()
            }
        return {} 