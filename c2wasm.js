/* C to WebAssembly compiler written in JS
 * by me7alix ;)
 *
 * MIT License
 */

/* Lexer stage */

let TOK = 0
	const TOK_ERR = TOK++
	const TOK_EOF = TOK++

	const TOK_SEMI = TOK++
	const TOK_COM  = TOK++

	const TOK_RET = TOK++

	const TOK_OBRA = TOK++
	const TOK_CBRA = TOK++
	const TOK_OPAR = TOK++
	const TOK_CPAR = TOK++

	const TOK_INT = TOK++
	const TOK_ID = TOK++

	const TOK_ST_WHILE = TOK++
	const TOK_ST_IF = TOK++

	const TOK_TP_VOID = TOK++
	const TOK_TP_INT = TOK++

	const TOK_PLUS = TOK++
	const TOK_MINUS = TOK++
	const TOK_STAR = TOK++
	const TOK_SLASH = TOK++
	const TOK_EXT = TOK++
	const TOK_EQ = TOK++
	const TOK_EQ_EQ = TOK++
	const TOK_GREATER = TOK++
	const TOK_GREATER_EQ = TOK++
	const TOK_LESS = TOK++
	const TOK_LESS_EQ = TOK++
	const TOK_AMP = TOK++
	const TOK_PIPE = TOK++
	const TOK_AND = TOK++
	const TOK_OR = TOK++
// TOK

const Lexer = class {
	constructor(code) {
		this.code = code
		this.count = 0
		this.line = 0
	}

	#ch()  { return this.code[this.count] + "";     }
	#ch2() { return this.code[this.count + 1] + ""; }

	token(_kind, _data) {
		return {
			kind: _kind,
			data: _data,
			line: this.line,
		}
	}

	next() {
		let res

		if (this.code.length <= this.count) {
			return this.token(TOK_EOF, "")
		}

		switch (this.#ch()) {
		case ';': res = this.token(TOK_SEMI,  ";"); break
		case '+': res = this.token(TOK_PLUS,  "+"); break
		case '-': res = this.token(TOK_MINUS, "-"); break
		case '*': res = this.token(TOK_STAR,  "*"); break
		case '/': res = this.token(TOK_SLASH, "/"); break
		case '{': res = this.token(TOK_OBRA,  "{"); break
		case '}': res = this.token(TOK_CBRA,  "}"); break
		case '(': res = this.token(TOK_OPAR,  "("); break
		case ')': res = this.token(TOK_CPAR,  ")"); break
		case ',': res = this.token(TOK_COM,   ","); break

		case '&':
			if (this.#ch2() === "&") {
				res = this.token(TOK_AND, "&&")
				this.count++
			} else {
				res = this.token(TOK_AMP, "&")
			}
			break

		case '|':
			if (this.#ch2() === "|") {
				res = this.token(TOK_OR, "||")
				this.count++
			} else {
				res = this.token(TOK_PIPE, "|")
			}
			break

		case '=':
			if (this.#ch2() === "=") {
				res = this.token(TOK_EQ_EQ, "==")
				this.count++
			} else {
				res = this.token(TOK_EQ, "=")
			}
			break

		case '>':
			if (this.#ch2() === "=") {
				res = this.token(TOK_GREATER_EQ, ">=")
				this.count++
			} else {
				res = this.token(TOK_GREATER, ">")
			}
			break

		case '<':
			if (this.#ch2() === "=") {
				res = this.token(TOK_LESS_EQ, "<=")
				this.count++
			} else {
				res = this.token(TOK_LESS, "<")
			}
			break

		case '\t':
		case ' ':
			this.count += 1
			return this.next()

		case '\n':
			this.line++
			this.count++
			return this.next()

		default:
			if (this.#ch().match(/[0-9]/i)) {
				let num = ""

				while (this.#ch().match(/[0-9]/i)) {
					num += this.#ch()
					this.count++
				}

				this.count--
				res = this.token(TOK_INT, num)
			}

			else if (this.#ch().match(/[a-z]/i)) {
				let id = ""

				while (this.#ch().match(/[a-z]/i)) {
					id += this.#ch()
					this.count++
				}

				this.count--

				if (id === "while") {
					res = this.token(TOK_ST_WHILE, id)
				} else if (id === "if") {
					res = this.token(TOK_ST_IF, id)
				} else if (id === "void") {
					res = this.token(TOK_TP_VOID, id)
				} else if (id === "int") {
					res = this.token(TOK_TP_INT, id)
				} else if (id === "return") {
					res = this.token(TOK_RET, id)
				} else {
					res = this.token(TOK_ID, id)
				}
			}

			else {
				res = this.token(TOK_ERR, "wrong #character")
			}
		}

		this.count++
		return res
	}

	peek() {
		let line = this.line
		let count = this.count
		let tok = this.next()
		this.line = line
		this.count = count
		return tok
	}

	peek2() {
		let line = this.line
		let count = this.count
		this.next()
		let tok = this.next()
		this.line = line
		this.count = count
		return tok
	}

	peek3() {
		let line = this.line
		let count = this.count
		this.next()
		this.next()
		let tok = this.next()
		this.line = line
		this.count = count
		return tok
	}
}

/* Parser stage */

let TYPE = 0
	const TYPE_INT = TYPE++
	const TYPE_VOID = TYPE++
// TYPE

let AST = 0
	const AST_PROG = AST++

	const AST_DEF_FUNC = AST++
	const AST_DEF_VAR = AST++

	const AST_ST_WHILE = AST++
	const AST_ST_IF = AST++

	const AST_EXPR_BIN = AST++
	const AST_EXPR_UN = AST++

	const AST_LIT = AST++
// AST

let OP = 0
	const OP_ADD = OP++
	const OP_SUB = OP++
	const OP_MUL = OP++
	const OP_DIV = OP++

	const OP_EQ = OP++
	const OP_LESS = OP++
	const OP_GREATER = OP++
	const OP_LESS_EQ = OP++
	const OP_GREATER_EQ = OP++
	const OP_EQ_EQ = OP++
	const OP_AND = OP++
	const OP_OR = OP++

	const OP_REF = OP++
	const OP_DEREF = OP++
	const OP_CAST = OP++
// OP

let LIT = 0
	const LIT_INT = LIT++
// LIT

let SYMB = 0
	const SYMB_VAR = SYMB++
	const SYMB_FUNC = SYMB++
// SYMB

const Parser = class {
	constructor(lexer) {
		this.symbol_table = []
		this.lexer = lexer
		this.prog = {
			kind: AST_PROG,
			body: []
		}
	}

	#n()  { return this.lexer.next();  }
	#p()  { return this.lexer.peek();  }
	#p2() { return this.lexer.peek2(); }
	#p3() { return this.lexer.peek3(); }

	#error(line, msg) {
		let lines = this.lexer.code.split('\n')
		throw `line ${(line + 1)}: ${msg}\n` + lines[line]
	}

	#push_scope() {
		this.symbol_table.push(new Map())
	}

	#pop_scope() {
		this.symbol_table.pop()
	}

	#symbol_table_add(line, key, symbol) {
		if (this.symbol_table.at(-1).has(key)) {
			error(line, "redifinition of the symbol")
		}

		this.symbol_table.at(-1).set(key, symbol)
	}

	#symbol_table_get(line, key) {
		for (let i = this.symbol_table.length - 1; i >= 0; i--) {
			if (this.symbol_table[i].has(key)) {
				return this.symbol_table[i].get(key)
			}
		}

		error(line, "no such symbol")
	}

	#expect(tok, kind) {
		if (tok.kind !== kind) {
			error(tok.line, `unexpected token \`${tok.data}\``)
		}
	}

	#is_type_next() {
		let res = true
		let line = this.lexer.line
		let count = this.lexer.count
		try { this.#parse_type(); }
		catch (e) { res = false; }
		this.lexer.line = line
		this.lexer.count = count
		return res;
	}

	#parse_type() {
		if (this.#p().kind === TOK_TP_INT) {
			this.#n()
			return TYPE_INT
		} else if (this.#p().kind === TOK_TP_VOID) {
			this.#n()
			return TYPE_VOID
		} else {
			error(this.#p().line, "no such type")
		}
	}

	#op_precedence(kind, l) {
		switch (kind) {
		case OP_EQ:
			return l ? 1 : 2
		case OP_ADD:
		case OP_SUB:
			return l ? 10 : 11
		case OP_MUL:
		case OP_DIV:
			return l ? 20 : 21
		}
	}

	#expr_expand(nodes) {
		for (var i = 0; i < nodes.length; i++) {
			var node = nodes[i]
			
			if (node.kind === AST_EXPR_BIN) {}
		}
	}

	#parse_expr() {
		let nodes = []
		while (this.#p().kind !== TOK_SEMI) {
			if (this.#p().kind === TOK_INT) {
				expr.push({
					kind: AST_LIT,
					lit: LIT_INT,
					value: this.#p().data,
				})
			} else if (this.#p().kind === TOK_ID) {
				if (symbol_table_get().kind )
			} else if (this.#p().kind === TOK_)
		}

		this.#n()
		return nodes
	}

	#parse_def_var() {
		let _type = this.#parse_type()
		let _name = this.#n().data
		let _expr = this.#parse_expr()

		return {
			type: _type,
			name: _name,
			expr: _expr,
		}
	}

	#parse_body() {
		this.#expect(this.#n(), TOK_OBRA)

		let body = []
		this.#push_scope()
		
		while (this.#p().kind !== TOK_CBRA) {
			if (this.#p2().kind === TOK_ID) {
				body.push(this.#parse_def_var())
			}
			//else if (this.#p().kind === TOK_ST_IF) {
			//	body.push(this.#parse_st_if())
			//}
		}

		this.#pop_scope()
		this.#n()

		return body
	}

	#parse_def_func() {
		let _type = this.#parse_type()

		this.#expect(this.#p(), TOK_ID)
		let _name = this.#n().data

		this.#expect(this.#n(), TOK_OPAR)
		let _args = []

		while (this.#p().kind !== TOK_CPAR) {
			if (this.#p().kind == TOK_COM) {
				this.#n()
			} else if (this.#p2().kind == TOK_ID) {
				let _type = this.#parse_type()
				this.#expect(this.#p(), TOK_ID)
				let _name = this.#n().data
				_args.push({type: _type, name: _name})
			} else {
				error(this.#p().line,
					`comma expected, found \`${this.#p().data}\``)
			}
		}

		this.#n()

		return {
			kind: AST_DEF_FUNC,
			type: _type,
			name: _name,
			args: _args,
			body: this.#parse_body(),
		}
	}

	parse() {
		this.#push_scope()
		while (this.#p().kind != TOK_EOF) {
			if (this.#p3().kind == TOK_OPAR) {
				this.prog.body.push(this.#parse_def_func())
			} else if (this.#p2().kind == TOK_ID) {
				this.prog.body.push(this.#parse_def_var())
			} else {
				error(this.#p().line, "invalid high level declaration")
			}
		}
	}
}

let lexer = new Lexer("void add(int a, int b) { int c; }")
let parser = new Parser(lexer)

var err = false
try { parser.parse(); }
catch (e) { err = true; console.log(e); }
if (!err) console.log(JSON.stringify(parser.prog, null, "  "));
