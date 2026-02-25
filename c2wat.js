/* Lexer stage */

const Lexer = class {
	constructor(code) {
		this.code = code
		this.count = 0
		this.line = 0
	}

	ch()  { return this.code[this.count] + "";     }
	ch2() { return this.code[this.count + 1] + ""; }

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
			return this.token("EOF", "")
		}

		switch (this.ch()) {
		case ';': res = this.token("SEMI",   ";"); break
		case '+': res = this.token("PLUS",   "+"); break
		case '-': res = this.token("MINUS",  "-"); break
		case '*': res = this.token("STAR",   "*"); break
		case '/': res = this.token("SLASH",  "/"); break
		case '{': res = this.token("OBRA",   "{"); break
		case '}': res = this.token("CBRA",   "}"); break
		case '(': res = this.token("OPAR",   "("); break
		case ')': res = this.token("CPAR",   ")"); break
		case ',': res = this.token("COM",    ","); break
		case '[': res = this.token("OSQBRA", "["); break
		case ']': res = this.token("CSQBRA", "]"); break

		case '!':
			if (this.ch2() === "=") {
				res = this.token("NOT_EQ", "!=")
				this.count++
			} else {
				res = this.token("EXT", "!")
			} break

		case '&':
			if (this.ch2() === "&") {
				res = this.token("AND", "&&")
				this.count++
			} else {
				res = this.token("AMP", "&")
			} break

		case '|':
			if (this.ch2() === "|") {
				res = this.token("OR", "||")
				this.count++
			} else {
				res = this.token("PIPE", "|")
			} break

		case '=':
			if (this.ch2() === "=") {
				res = this.token("EQ_EQ", "==")
				this.count++
			} else {
				res = this.token("EQ", "=")
			} break

		case '>':
			if (this.ch2() === "=") {
				res = this.token("GREATER_EQ", ">=")
				this.count++
			} else {
				res = this.token("GREATER", ">")
			} break

		case '<':
			if (this.ch2() === "=") {
				res = this.token("LESS_EQ", "<=")
				this.count++
			} else {
				res = this.token("LESS", "<")
			} break

		case '\t':
		case ' ':
			this.count += 1
			return this.next()

		case '\n':
			this.line++
			this.count++
			return this.next()

		default:
			if (this.ch().match(/[0-9]/i)) {
				let num = ""
				let is_float = false

				while (this.ch().match(/[0-9\.]/i)) {
					num += this.ch()
					if (this.ch() === '.')
						is_float = true
					this.count++
				}

				this.count--
				if (!is_float) res = this.token("INT", num)
				else           res = this.token("FLOAT", num)
			}

			else if (this.ch() === "'") {
				this.count++
				let err = false
				let ch = ""

				if (this.ch() === "\\") {
					this.count++
					switch (this.ch()) {
					case 'n':  ch = "\n"; break
					case 'r':  ch = "\r"; break
					case '0':  ch = "\0"; break
					case '\\': ch = "\\"; break
					default:   err = true
					}
				} else {
					ch = this.ch()
				}

				this.count++
				if (err || this.ch() !== "'") {
					res = this.token("ERR", "invalid character");
				}

				res = this.token("CHAR", ch)
			}

			else if (this.ch().match(/[a-zA-Z_]/i)) {
				let id = ""

				while (this.ch().match(/[a-zA-Z0-9_]/i)) {
					id += this.ch()
					this.count++
				}

				this.count--

				if (id === "while") {
					res = this.token("ST_WHILE", id)
				} else if (id === "if") {
					res = this.token("ST_IF", id)
				} else if (id === "else") {
					res = this.token("ST_ELSE", id)
				} else if (id === "void") {
					res = this.token("TP_VOID", id)
				} else if (id === "int") {
					res = this.token("TP_INT", id)
				} else if (id === "break") {
					res = this.token("LP_BREAK", id)
				} else if (id === "continue") {
					res = this.token("LP_CONTINUE", id)
				} else if (id === "float") {
					res = this.token("TP_FLOAT", id)
				} else if (id === "extern") {
					res = this.token("EXTERN", id)
				} else if (id === "return") {
					res = this.token("RET", id)
				} else {
					res = this.token("ID", id)
				}
			}

			else {
				res = this.token("ERR", "invalid character")
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

const Parser = class {
	constructor(lexer) {
		this.externs = []
		this.symbol_table = []
		this.cur_func = []
		this.var_ind = 0
		this.lexer = lexer
		this.prog = {
			kind: "PROG",
			body: []
		}
	}

	n()  { return this.lexer.next();  } // next
	p()  { return this.lexer.peek();  } // peek
	p2() { return this.lexer.peek2(); } // peek2
	p3() { return this.lexer.peek3(); } // peek3

	error(line, msg) {
		let lines = this.lexer.code.split('\n')
		throw `line ${(line + 1)}: error: ${msg}\n` + lines[line]
	}

	push_scope() {
		this.symbol_table.push(new Map())
	}

	pop_scope() {
		this.symbol_table.pop()
	}

	symbol_table_add(line, key, symbol) {
		if (this.symbol_table.at(-1).has(key)) {
			this.error(line, `redifinition of the symbol \`${key}\``)
		}

		this.symbol_table.at(-1).set(`${symbol.kind} ${key}`, symbol)
		if (symbol.kind === "VAR")
			this.cur_func.vars.push(symbol)
	}

	symbol_table_get(line, key) {
		for (let i = this.symbol_table.length - 1; i >= 0; i--) {
			if (this.symbol_table[i].has(key)) {
				return this.symbol_table[i].get(key)
			}
		}

		this.error(line, `no such symbol \`${key}\``)
	}

	expect(tok, kind) {
		if (tok.kind !== kind) {
			if (tok.kind === "ERR") {
				this.error(tok.line, tok.data)
			} else {
				this.error(tok.line, `unexpected token \`${tok.data}\``)
			}
		}
	}

	is_type_next(need_name) {
		let res = true
		let line = this.lexer.line
		let count = this.lexer.count
		try { this.parse_type(need_name); }
		catch (e) { res = false; }
		this.lexer.line = line
		this.lexer.count = count
		return res;
	}

	compare_types(a, b) {
		if (a.kind !== b.kind)
			return false

		if (a.kind === "POINTER" || a.kind === "ARRAY") {
			if (a.kind === "ARRAY") {
				if (a.length !== b.length)
					return false
			}

			return this.compare_types(a.base, b.base);
		}

		return true
	}

	parse_type(need_name) {
		let _type = null
		let _name = null
		let tp = ""

		switch (this.n().kind) {
		case "TP_INT":   tp = "INT";   break
		case "TP_VOID":  tp = "VOID";  break
		case "TP_FLOAT": tp = "FLOAT"; break
		default: this.error(this.p().line, "no such type")
		}

		_type = { kind: tp }

		while (this.p().kind === "STAR") {
			this.n()
			_type = {
				kind: "POINTER",
				base: _type,
			}
		}

		if (this.p().kind === "ID" && need_name) {
			_name = this.n().data
		}

		while (this.p().kind === "OSQBRA") {
			this.n()
			let expr = this.parse_expr(["CSQBRA"])
			if (expr.kind !== "LIT" || expr.type.kind !== "INT") {
				this.error(this.p().line, "int literal expected")
			}

			_type = {
				kind: "ARRAY",
				base: _type,
				length: expr.value,
			}
		}

		return {
			type: _type,
			name: _name,
		}
	}

	op_precedence(kind, l) {
		switch (kind) {
		case "EQ":
			return l ? 1 : 2
		case "AND":
		case "OR":
			return l ? 3 : 4
		case "LESS":
		case "GREATER":
		case "LESS_EQ":
		case "GREATER_EQ":
		case "NOT_EQ":
		case "EQ_EQ":
			return l ? 5 : 6
		case "ADD":
		case "SUB":
			return l ? 10 : 11
		case "MUL":
		case "DIV":
			return l ? 20 : 21
		case "NEG":
		case "NOT":
		case "CAST":
			return l ? -1 : 30
		}
	}

	tok_to_un_op(tok) {
		switch (tok.kind) {
		case "AMP":   return "REF"
		case "STAR":  return "DEREF"
		case "MINUS": return "NEG"
		case "EXT":   return "NOT"
		}
	}

	tok_to_bin_op(tok) {
		switch (tok.kind) {
		case "PLUS":       return "ADD"
		case "MINUS":      return "SUB"
		case "STAR":       return "MUL"
		case "SLASH":      return "DIV"
		case "AND":        return "AND"
		case "OR":         return "OR"
		case "EQ":         return "EQ"
		case "EQ_EQ":      return "EQ_EQ"
		case "NOT_EQ":     return "NOT_EQ"
		case "LESS":       return "LESS"
		case "GREATER":    return "GREATER"
		case "LESS_EQ":    return "LESS_EQ"
		case "GREATER_EQ": return "GREATER_EQ"
		}
	}

	pref_func(str) { return `FUNC ${str}`; }
	pref_var(str)  { return `VAR ${str}`;  }

	parse_func_call() {
		let count = 0
		let _name = this.n().data
		let _args = []
		let _line = this.p().line
		let smbl = this.symbol_table_get(
			this.p().line,
			this.pref_func(_name))
		let _type = smbl.type
		let _fargs = smbl.args

		this.expect(this.n(), "OPAR")
		while (this.p().kind !== "CPAR") {
			if (count > _fargs.length - 1)
				this.error(_line, "too many arguments")

			let _expr = this.expr_num_cast(
				this.parse_expr(["CPAR", "COM"]),
				_fargs[count].type)

			_args.push(_expr)
			this.lexer.count--
			if (this.p().kind === "COM")
				this.n()

			if (!this.compare_types(_expr.type, _fargs[count].type))
				this.error(_line, "types mismatching")

			count++
		}

		if (count < _fargs.length)
			this.error(_line, "not enough arguments")

		this.n()

		return {
			kind: "CALL_FUNC",
			type: _type,
			name: _name,
			line: _line,
			args: _args,
		}
	}

	expr_num_cast(num, type) {
		if (type.kind === "FLOAT" && num.type.kind === "INT") {
			return {
				kind: "EXPR_UN",
				op: "CAST",
				type: { kind: "FLOAT" },
				oprd: num,
			}
		}

		return num
	}

	expr_calc_types(expr) {
		switch (expr.kind) {
		case "VAR":
		case "LIT":
		case "CALL_FUNC":
			return expr.type

		case "EXPR_UN":
			if (expr.oprd === null) {
				this.error(expr.line, "invalid expression")
			}

			if (expr.op === "CAST") {
				this.expr_calc_types(expr.oprd)
				return expr.type
			}

			expr.type = this.expr_calc_types(expr.oprd)
			return expr.type

		case "EXPR_BIN":
			if (expr.lhs === null || expr.rhs === null) {
				this.error(expr.line, "invalid expression")
			}

			let lhst = this.expr_calc_types(expr.lhs)
			let rhst = this.expr_calc_types(expr.rhs)
			expr.type = lhst

			if ((lhst.kind === "FLOAT" && rhst.kind === "INT") ||
				(rhst.kind === "FLOAT" && lhst.kind === "INT") && expr.op !== "EQ") {
				expr.type = { kind: "FLOAT" }
				let lhsti = lhst.kind === "INT"
				if (lhsti) expr.lhs = this.expr_num_cast(expr.lhs, rhst)
				else       expr.rhs = this.expr_num_cast(expr.rhs, lhst)
			} else if ((lhst.kind === "ARRAY" && rhst.kind === "INT") ||
				((rhst.kind === "ARRAY" && lhst.kind === "INT")) ||
				(lhst.kind === "POINTER" && rhst.kind === "INT") ||
				((rhst.kind === "POINTER" && lhst.kind === "INT")) ) {
				if (expr.op !== "ADD" || expr.op !== "SUB") {
					this.error(expr.line, "invalid operation")
				}
			} else if (!this.compare_types(lhst, rhst)) {
				this.error(expr.line, "types mismatching")
			}

			switch (expr.op) {
			case "OR": case "AND":
			case "EQ_EQ": case "NOT_EQ":
			case "LESS": case "GREATER":
			case "LESS_EQ": case "GREATER_EQ":
				expr.type = { kind: "INT" }
			}

			return expr.type
		}
	}

	expr_expand(nodes) {
		let old_size = nodes.length

		for (let i = 0; i < nodes.length; i++) {
			if (nodes.length == 1) {
				return nodes[0]
			}

			let node = nodes[i]
			let is_op = false;

			if (node.kind == "EXPR_BIN") {
				if (node.lhs === null || node.rhs === null) is_op = true;
			} else if (node.kind == "EXPR_UN") {
				if (node.oprd === null) is_op = true;
			}

			if (!is_op) {
				let lhs = -1
				let rhs = -1

				if (i > 0)
					lhs = this.op_precedence(nodes[i-1].op, false)

				if (i < nodes.length - 1)
					rhs = this.op_precedence(nodes[i+1].op, true)

				if (lhs === -1 && rhs === -1)
					this.error(nodes[i].line, "invalid combination of operators and operands")

				if (lhs > rhs) {
					if (nodes[i-1].kind === "EXPR_BIN") {
						nodes[i-1].rhs = nodes[i]
					} else if (nodes[i-1].kind === "EXPR_UN") {
						nodes[i-1].oprd = nodes[i]
					} else this.error(nodes[i-1].line, "invalid expression")
				} else {
					if (nodes[i+1].kind === "EXPR_BIN") {
						nodes[i+1].lhs = nodes[i]
					} else if (nodes[i+1].kind === "EXPR_UN") {
						nodes[i+1].oprd = nodes[i]
					} else this.error(nodes[i+1].line, "invalid expression")
				}

				nodes.splice(i--, 1)
			}
		}

		if (old_size === nodes.length) {
			this.error(this.p().line, "invalid expression")
		}

		return this.expr_expand(nodes)
	}

	parse_expr(until) {
		let nodes = []
		loop: while (true) {
			for (let i = 0; i < until.length; i++) {
				if (until[i] === this.p().kind) break loop
			}

			switch (this.p().kind) {
			case "CHAR": {
				nodes.push({
					kind: "LIT",
					line: this.p().line,
					type: { kind: "INT" },
					lit: "INT",
					value: this.n().data.charCodeAt(0),
				})
			} break

			case "INT": {
				nodes.push({
					kind: "LIT",
					line: this.p().line,
					type: { kind: "INT" },
					lit: "INT",
					value: this.n().data,
				})
			} break

			case "FLOAT": {
				nodes.push({
					kind: "LIT",
					line: this.p().line,
					type: { kind: "FLOAT" },
					lit: "FLOAT",
					value: this.n().data,
				})
			} break

			case "OPAR":
				this.n()
				if (this.is_type_next(false)) {
					let _line = this.p().line
					let _type = this.parse_type(false).type

					nodes.push({
						kind: "EXPR_UN",
						line: _line,
						op: "CAST",
						type: _type,
						oprd: null,
					})

					this.expect(this.n(), "CPAR")
				} else {
					nodes.push(this.parse_expr(["CPAR"]))
				}
				break

			case "ID": {
				if (this.p2().kind != "OPAR") {
					let smbl = this.symbol_table_get(
						this.p().line,
						this.pref_var(this.p().data))

					nodes.push({
						kind: "VAR",
						line: this.p().line,
						type: smbl.type,
						id: smbl.id,
						name: this.n().data
					})
				} else {
					nodes.push(this.parse_func_call())
				}
			} break

			case "AND":
			case "OR":
			case "EQ":
			case "EQ_EQ":
			case "NOT_EQ":
			case "LESS":
			case "GREATER":
			case "LESS_EQ":
			case "GREATER_EQ":
			case "SLASH":
			case "PLUS": {
				nodes.push({
					kind: "EXPR_BIN",
					line: this.p().line,
					op: this.tok_to_bin_op(this.n()),
					type: "",
					lhs: null, rhs: null,
				})
			} break

			case "EXT": {
				nodes.push({
					kind: "EXPR_UN",
					line: this.p().line,
					op: this.tok_to_un_op(this.n()),
					type: "",
					oprd: null,
				})
			} break

			case "AMP":
			case "STAR":
			case "MINUS": {
				let op = this.p().kind
				let is_unary_op = false

				if (nodes.length === 0) {
					is_unary_op = true
				} else {
					if (nodes.at(-1) === "EXPR_UN") {
						is_unary_op = false
					} else {
						let is_bin_op = nodes.at(-1).kind === "EXPR_BIN"
						if (is_bin_op && nodes.at(-1).lhs !== null && nodes.at(-1).rhs !== null)
							is_bin_op = false
						if (is_bin_op) is_unary_op = true
					}
				}

				if (is_unary_op) {
					nodes.push({
						kind: "EXPR_UN",
						line: this.p().line,
						op: this.tok_to_un_op(this.n()),
						type: "",
						oprd: null
					})
				} else {
					nodes.push({
						kind: "EXPR_BIN",
						line: this.p().line,
						op: this.tok_to_bin_op(this.n()),
						type: "",
						lhs: null, rhs: null,
					})
				}
			} break

			default:
				this.error(this.p().line,
					`invalid operator / operand \`${this.p().data}\``)
			}
		}

		this.n()
		let expr = this.expr_expand(nodes)
		this.expr_calc_types(expr)
		return expr
	}

	parse_def_var() {
		let line = this.p().line

		let tan = this.parse_type(true)
		let _type = tan.type
		let _name = tan.name

		let _id = `V${this.var_ind++}`
		let _expr = null

		if (this.p().kind === "EQ") {
			this.n()
			_expr = this.expr_num_cast(this.parse_expr(["SEMI"]), _type)
			if (!this.compare_types(_type, _expr.type))
				this.error(line, "types mismatching")
		} else {
			this.expect(this.n(), "SEMI")
		}

		this.symbol_table_add(line, _name, {
			kind: "VAR", type: _type, id: _id,
		})

		return {
			kind: "DEF_VAR",
			type: _type,
			name: _name,
			id: _id,
			expr: _expr,
		}
	}

	parse_mut_var() {
		return {
			kind: "MUT_VAR",
			expr: this.parse_expr(["SEMI"]),
		}
	}

	parse_func_ret() {
		let line = this.n().line

		let _expr = null
		if (this.p().kind !== "SEMI") {
			_expr = this.expr_num_cast(
				this.parse_expr(["SEMI"]),
				this.cur_func.type)
		}

		if (!this.compare_types(this.cur_func.type, _expr.type))
			this.error(line, "types mismatching")

		return {
			kind: "RET",
			type: _expr.type,
			expr: _expr,
		}
	}

	parse_st_if() {
		this.n()

		this.expect(this.n(), "OPAR")
		let _cond = this.parse_expr(["CPAR"])
		let _body = this.parse_body(false)

		let st_if = {
			kind: "ST_IF",
			cond: _cond,
			body: _body,
			next: null,
		}

		if (this.p().kind === "ST_ELSE") {
			if (this.p2().kind == "ST_IF") {
				this.n();
				st_if.next = this.parse_st_if()
			} else {
				this.n();
				st_if.next = {
					kind: "ST_ELSE",
					body: this.parse_body(false),
				}
			}
		}

		return st_if
	}

	parse_st_while() {
		this.n()

		this.expect(this.n(), "OPAR")
		let _cond = this.parse_expr(["CPAR"])
		let _body = this.parse_body(false)

		return {
			kind: "ST_WHILE",
			cond: _cond,
			body: _body,
		}
	}

	parse_body(skip_push) {
		this.expect(this.n(), "OBRA")
		let body = []

		if (!skip_push)
			this.push_scope()

		while (this.p().kind !== "CBRA") {
			if (this.is_type_next(true))
				body.push(this.parse_def_var())

			else if (this.p().kind === "RET")
				body.push(this.parse_func_ret())

			else if (this.p().kind == "ST_IF")
				body.push(this.parse_st_if())

			else if (this.p().kind == "ST_WHILE")
				body.push(this.parse_st_while())

			else if (this.p().kind == "LP_BREAK") {
				body.push({kind: "LP_BREAK"})
				this.n(); this.expect(this.n(), "SEMI")
			}

			else if (this.p().kind == "LP_CONTINUE") {
				body.push({kind: "LP_CONTINUE"})
				this.n(); this.expect(this.n(), "SEMI")
			}

			else body.push(this.parse_mut_var())
		}

		if (!skip_push)
			this.pop_scope()

		this.n()

		return body
	}

	parse_def_func(is_extern) {
		let _type = this.parse_type(false).type

		this.expect(this.p(), "ID")
		let _name = this.n().data

		this.expect(this.n(), "OPAR")
		let _args = []

		while (this.p().kind !== "CPAR") {
			if (this.p().kind == "COM") {
				this.n()
			} else if (this.p2().kind == "ID") {
				let _type = this.parse_type(false).type
				this.expect(this.p(), "ID")
				let _name = this.n().data
				_args.push({
					type: _type,
					name: _name,
					id: `V${this.var_ind++}`
				})
			} else {
				this.expect(this.p(), "COM")
			}
		}

		this.n()

		let func = {
			kind: "DEF_FUNC",
			type: _type,
			name: _name,
			args: _args,
			vars: [],
		}

		this.cur_func = func
		this.symbol_table_add(this.p().line, _name, {
			kind: "FUNC",
			type: _type,
			args: _args,
		})

		if (is_extern) {
			this.externs.push({
				type: _type,
				name: _name,
				args: _args,
			})
		}

		if (!is_extern) {
			this.push_scope()

			_args.forEach((arg) => {
				this.symbol_table_add(this.p().line, arg.name, {
					kind: "VAR",
					type: arg.type,
					id: arg.id,
				})
			})

			func.body = []
			if (this.p().kind !== "SEMI") {
				func.body = this.parse_body(true)
			} else this.n()

			this.pop_scope()
		} else {
			this.expect(this.n(), "SEMI")
		}

		return func
	}

	parse() {
		this.push_scope()
		while (this.p().kind != "EOF") {
			if (this.p3().kind == "OPAR") {
				this.prog.body.push(this.parse_def_func(false))
			} else if (this.p2().kind == "ID") {
				this.prog.body.push(this.parse_def_var())
			} else if (this.p().kind == "EXTERN") {
				this.n()
				this.parse_def_func(true)
			} else {
				this.error(this.p().line, "invalid high level declaration")
			}
		}
	}
}

/* Codegen stage */

const Codegen = class {
	constructor(parser) {
		this.code = ""
		this.loop_ind = 0
		this.intend = 0
		this.cur_func = null
		this.parser = parser
	}

	emit(text) {
		for (let i = 0; i < this.intend; i++)
			this.code += "    "
		this.code += text + "\n"
	}

	wat_type(type) {
		switch (type.kind) {
		case "POINTER": return "i32"
		case "ARRAY":   return "i32"
		case "INT":     return "i32"
		case "FLOAT":   return "f32"
		}
	}

	emit_expr(expr) {
		switch (expr.kind) {
		case "LIT":
			this.emit(`${this.wat_type(expr.type)}.const ${expr.value}`)
			break

		case "CALL_FUNC":
			expr.args.forEach((it) => {
				this.emit_expr(it)
			})

			this.emit(`call \$${expr.name}`)
			break

		case "VAR":
			this.emit(`local.get \$${expr.id}`)
			break

		case "EXPR_UN": {
			let wt = this.wat_type(expr.type)

			if (expr.op === "CAST") {
				this.emit_expr(expr.oprd)
				if (!this.parser.compare_types(expr.type, expr.oprd.type)) {
					switch (expr.oprd.type.kind) {
					case "INT":   this.emit(`${wt}.convert_i32_s`); break
					case "FLOAT": this.emit(`${wt}.trunc_f32_s`);   break
					}
				}
				return
			}

			switch (expr.op) {
			case "NEG":
				switch (expr.type.kind) {
				case "INT":
					this.emit("i32.const 0")
					this.emit_expr(expr.oprd)
					this.emit(`${wt}.sub`)
					break

				case "FLOAT":
					this.emit_expr(expr.oprd)
					this.emit(`${wt}.neg`)
					break
				} break

			case "NOT":
				this.emit(`${wt}.eqz`)
				break
			}
		} break

		case "EXPR_BIN": {
			if (expr.op === "EQ") {
				this.emit_expr(expr.rhs)
				this.emit(`local.set \$${expr.lhs.id}`)
				return
			}

			this.emit_expr(expr.lhs)
			this.emit_expr(expr.rhs)

			let wt = this.wat_type(expr.type)
			let lt = expr.lhs.type

			switch (expr.op) {
			case "ADD": this.emit(`${wt}.add`); break
			case "SUB": this.emit(`${wt}.sub`); break
			case "MUL": this.emit(`${wt}.mul`); break
			case "EQ_EQ": this.emit(`${wt}.eq`); break
			case "NOT_EQ": this.emit(`${wt}.ne`); break
			case "AND": this.emit(`${wt}.and`); break
			case "OR": this.emit(`${wt}.or`); break

			case "DIV":
				switch (lt.kind) {
				case "INT":   this.emit(`i32.div_s`); break
				case "FLOAT": this.emit(`f32.div`); break
				} break

			case "LESS":
				switch (lt.kind) {
				case "INT":   this.emit(`i32.lt_s`); break
				case "FLOAT": this.emit(`f32.lt`); break
				} break

			case "GREATER":
				switch (lt.kind) {
				case "INT":   this.emit(`i32.gt_s`); break
				case "FLOAT": this.emit(`f32.gt`); break
				} break

			case "LESS_EQ":
				switch (lt.kind) {
				case "INT":   this.emit(`i32.le_s`); break
				case "FLOAT": this.emit(`f32.le`); break
				} break

			case "GREATER_EQ":
				switch (lt.kind) {
				case "INT":   this.emit(`i32.ge_s`); break
				case "FLOAT": this.emit(`f32.ge`); break
				} break
			}
		} break
		}
	}

	emit_def_var(vd) {
		this.emit(`(local \$${vd.id} ${this.wat_type(vd.type)})`);
	}

	emit_def_var_val(vd) {
		if (vd.expr !== null) {
			this.emit_expr(vd.expr)
			this.emit(`local.set \$${vd.id}`)
		}
	}

	emit_mut_var(mv) {
		this.emit_expr(mv.expr)
	}

	emit_func_ret(rt) {
		if (rt.expr !== null)
			this.emit_expr(rt.expr)
		this.emit("return")
	}

	emit_st_while(wst) {
		this.loop_ind++
		this.emit(`(block \$WO${this.loop_ind}`)
		this.intend++
			this.emit(`(loop \$WI${this.loop_ind}`)

			this.intend++
				this.emit_expr(wst.cond)
				this.emit("i32.eqz")
				this.emit(`br_if \$WO${this.loop_ind}`)
				this.emit("")
			this.intend--

			this.emit_body(wst.body)

			this.intend++
				this.emit(`br \$WI${this.loop_ind}`)
			this.intend--

			this.emit(")")
		this.intend--
		this.emit(")")
		this.loop_ind--
	}

	emit_st_if(ifst) {
		this.emit_expr(ifst.cond)

		this.emit("(if")
		this.intend++

		this.emit("(then")
		this.emit_body(ifst.body)
		this.emit(")")

		if (ifst.next !== null) {
			this.emit("(else")

			if (ifst.next.kind == "ST_IF") {
				this.intend++
				this.emit_st_if(ifst.next)
				this.intend--
			} else this.emit_body(ifst.next.body)

			this.emit(")")
		}

		this.intend--
		this.emit(")")
	}

	emit_body(body) {
		this.intend++

		body.forEach((it) => {
			switch (it.kind) {
			case "DEF_VAR":  this.emit_def_var_val(it); break
			case "MUT_VAR":  this.emit_mut_var(it);     break
			case "ST_IF":    this.emit_st_if(it);       break
			case "ST_WHILE": this.emit_st_while(it);    break
			case "RET":      this.emit_func_ret(it);    break

			case "LP_BREAK":
				this.emit(`br \$WO${this.loop_ind}`)
				break

			case "LP_CONTINUE":
				this.emit(`br \$WI${this.loop_ind}`)
				break
			}
		})

		this.intend--
	}

	emit_func_sig(func) {
		let skip = []
		func.args.forEach((it) => {
			skip.push(it.id)
			this.emit(`(param \$${it.id} ${this.wat_type(it.type)})`)
		})

		switch (func.type.kind) {
		case "INT":   this.emit("(result i32)"); break
		case "FLOAT": this.emit("(result f32)"); break
		case "VOID":  this.emit("(result)");     break
		}

		return skip
	}

	emit_def_func(func) {
		this.emit(`(func \$${func.name} (export "${func.name}")`)
		this.intend++

		let skip = this.emit_func_sig(func)

		this.emit("")
		let locals = false
		func.vars.forEach((it) => {
			if (!skip.includes(it.id)) {
				locals = true
				this.emit_def_var(it)
			}
		})

		if (locals) this.emit("")
		this.intend--

		this.emit_body(func.body)

		this.emit(")")
	}

	emit_prog() {
		this.emit("(module")
		this.intend++

		this.parser.externs.forEach((it) => {
			this.emit(`(import "env" "${it.name}" (func \$${it.name}`)
			this.intend++
			this.emit_func_sig(it)
			this.intend--
			this.emit("))")
		})

		this.parser.prog.body.forEach((it) => {
			switch (it.kind) {
			case "DEF_FUNC": this.emit_def_func(it); break
			}
		})

		this.intend--
		this.emit(")")
	}
}

export function compileCToWat(code) {
	let lexer = new Lexer(code)

	let parser = new Parser(lexer)
	parser.parse()

	let codegen = new Codegen(parser)
	codegen.emit_prog()

	return codegen.code
}
