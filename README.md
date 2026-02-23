# c2wasm.js

**c2wasm.js** (technically *c2wat*) is a small C to human-readable WebAssembly compiler written in JavaScript.

It implements a minimal subset of the C language and compiles it to WAT (WebAssembly Text format).

## Example

### Input (C)

```c
int add(int a, int b) {
    return a + b;
}
```

### Output (WAT)

```wat
(module
    (func $add (export "add")
        (param $V0 i32)
        (param $V1 i32)
        (result i32)

        local.get $V0
        local.get $V1
        i32.add
        return
    )
)
```
