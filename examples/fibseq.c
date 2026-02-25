extern void print_int(int val);
extern void print_float(float val);

void fib(int n) {
  int a = 1;
  int b = 1;

  int i = 0; while (i < n) {
    print_int(a);

    int t = b;
    b = b + a;
    a = t;

    i = i + 1;
  }
}
