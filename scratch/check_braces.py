import sys

def check_brackets(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    stack = []
    mapping = {')': '(', ']': '[', '}': '{'}
    lines = content.split('\n')
    
    in_string = False
    string_char = None
    in_comment = False
    in_multiline_comment = False
    
    for line_idx, line in enumerate(lines, 1):
        i = 0
        while i < len(line):
            char = line[i]
            
            # Handle multiline comments
            if in_multiline_comment:
                if i < len(line) - 1 and line[i:i+2] == '*/':
                    in_multiline_comment = False
                    i += 2
                    continue
                i += 1
                continue
                
            # Handle single line comments
            if not in_string and i < len(line) - 1 and line[i:i+2] == '//':
                break # ignore rest of line
                
            if not in_string and i < len(line) - 1 and line[i:i+2] == '/*':
                in_multiline_comment = True
                i += 2
                continue
                
            # Handle string literals
            if in_string:
                if char == '\\':
                    i += 2 # skip escaped char
                    continue
                if char == string_char:
                    in_string = False
                i += 1
                continue
                
            if char in ["'", '"', '`']:
                in_string = True
                string_char = char
                i += 1
                continue
                
            # Check brackets
            if char in mapping.values():
                stack.append((char, line_idx, i + 1))
            elif char in mapping.keys():
                if not stack:
                    print(f"Mismatched closing bracket '{char}' at line {line_idx}, column {i + 1}")
                    return False
                top_char, top_line, top_col = stack.pop()
                if top_char != mapping[char]:
                    print(f"Mismatched brackets: '{char}' at line {line_idx}, col {i + 1} does not match '{top_char}' from line {top_line}, col {top_col}")
                    return False
            i += 1
            
    if stack:
        for char, line, col in stack:
            print(f"Unclosed opening bracket '{char}' from line {line}, column {col}")
        return False
        
    print("All brackets, parentheses, and braces are perfectly matched!")
    return True

if __name__ == '__main__':
    check_brackets('src/app.js')
