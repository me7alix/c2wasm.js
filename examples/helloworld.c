extern void print_char(int val);
void print_str(char *str) {
  while (*str) {
    print_char(*str);
    str = str + 1;
  }
}

void main() {
  print_str("Hello, World!\n");
}
