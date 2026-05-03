
import fs from 'fs';

const content = fs.readFileSync('/src/components/AdminPanel.tsx', 'utf-8');
const lines = content.split('\n');

let stack = [];
lines.forEach((line, index) => {
  const matches = line.matchAll(/<(div|motion\.div|main|header|AnimatePresence|AnimatePresence mode="wait")|(\/(div|motion\.div|main|header|AnimatePresence))/g);
  for (const match of matches) {
    if (match[1]) {
      stack.push({ tag: match[1], line: index + 1 });
    } else {
      const closingTag = match[3];
      if (stack.length === 0) {
        console.log(`Unexpected closing tag </${closingTag}> at line ${index + 1}`);
      } else {
        const last = stack.pop();
        // Check match
        if (last.tag.startsWith(closingTag) || (closingTag === 'div' && last.tag === 'motion.div')) {
           // match
        } else if (last.tag === 'AnimatePresence mode="wait"' && closingTag === 'AnimatePresence') {
           // match
        } else {
           console.log(`Mismatch: opening <${last.tag}> at line ${last.line} closed by </${closingTag}> at line ${index + 1}`);
        }
      }
    }
  }
});

stack.forEach(item => {
  console.log(`Unclosed tag <${item.tag}> at line ${item.line}`);
});
