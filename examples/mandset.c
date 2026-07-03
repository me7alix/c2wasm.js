extern void print_int(int val);
extern void print_float(float val);
extern void print_char(int val);

void main() {
  float fromX = -2.0;
  float fromY = -1.1;
  float toX   = 1.0;
  float toY   = 1.1;
  float stepX = 0.032;
  float stepY = 0.075;

  char *grad = " .,:;ilox0#@";
  int grad_len = 12;

  float i = fromY; while (i < toY) {
    float j = fromX; while (j < toX) {
      float c_r = j;
      float c_i = i;
      float z_r = j;
      float z_i = i;

      int iters = 100;
      int iter = 0;

      while (iter < iters) {
        float tmp_r = z_r * z_r - z_i * z_i + c_r;
        float tmp_i = 2.0 * z_r * z_i       + c_i;

        z_r = tmp_r;
        z_i = tmp_i;

        iter = iter + 1;

        if (z_i * z_i + z_r * z_r > 4.0) {
          break;
        }
      }

      int idx = (int)(iter / (float)iters * (grad_len - 1));
      print_char(grad[idx]);
      j = j + stepX;
    }

    print_char('\n');
    i = i + stepY;
  }
}
