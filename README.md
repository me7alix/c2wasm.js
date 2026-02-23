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

## Grammar
```
<program> ::= <declaration>* <statement>*

<type> ::= "int"
         | "float"
         | "void"

<declaration> ::= <type> <identifier> ("=" <expression>)? ";"

<statement> ::= 
      <assignment>
    | <if-statement>
    | <while-statement>
    | <break-statement>
    | <continue-statement>
    | <compound-statement>

<assignment> ::= <identifier> "=" <expression> ";"

<if-statement> ::= "if" "(" <expression> ")" <statement> ("else" <statement>)?

<while-statement> ::= "while" "(" <expression> ")" <statement>

<break-statement> ::= "break" ";"

<continue-statement> ::= "continue" ";"

<compound-statement> ::= "{" <statement>* "}"

<expression> ::= <equality>

<equality> ::= <comparison> ( ("==" | "!=") <comparison> )*

<comparison> ::= <term> ( (">" | "<" | ">=" | "<=") <term> )*

<term> ::= <factor> ( ("+" | "-") <factor> )*

<factor> ::= <unary> ( ("*" | "/") <unary> )*

<unary> ::= ("!" | "-") <unary>
          | <primary>

<primary> ::= <identifier>
            | <number>
            | "(" <expression> ")"

<identifier> ::= [a-zA-Z_] [a-zA-Z_0-9]*

<number> ::= <int-number> | <float-number>

<int-number> ::= [0-9]+

<float-number> ::= [0-9]+ "." [0-9]+
```
