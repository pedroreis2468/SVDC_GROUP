import re

with open("c:/Users/mjurb/Desktop/MIA/2/svdc/src/app.js", "r", encoding="utf-8") as f:
    content = f.read()

# Basic bracket matcher
stack = []
pairs = {')': '(', ']': '[', '}': '{'}
lines = content.split('\n')

for i, line in enumerate(lines):
    # Strip comments
    line = re.sub(r'//.*', '', line)
    line = re.sub(r'/\*.*?\*/', '', line)
    for char in line:
        if char in '([{':
            stack.append((char, i+1))
        elif char in ')]}':
            if not stack:
                print(f"Error: Unmatched closing character '{char}' at line {i+1}")
                exit(1)
            opening, line_num = stack.pop()
            if opening != pairs[char]:
                print(f"Error: Mismatched closing character '{char}' at line {i+1} (opened with '{opening}' at line {line_num})")
                exit(1)

if stack:
    print(f"Error: Unmatched opening characters at end of file:")
    for char, line_num in stack:
        print(f"  '{char}' opened at line {line_num}")
    exit(1)
else:
    print("Syntax brace validation: SUCCESS!")
