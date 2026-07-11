"use strict";

/* Lexer stage */

const Lexer = class {
	constructor(code) {
		this.code = code
		this.count = 0
		this.line = 0
	}

	ch()  { return this.code[this.count]     + ''; }
	ch2() { return this.code[this.count + 1] + ''; }

	token(kind, data) {
		return {
			kind, data,
			line: this.line,
		}
	}

	next() {
		let res
		if (this.code.length <= this.count)
			return this.token("EOF", "")

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
				let flt = false

				while (this.ch().match(/[0-9\.]/i)) {
					num += this.ch()
					if (this.ch() === '.')
						flt = true
					this.count++
				}

				this.count--
				if (!flt) res = this.token("INT", num)
				else      res = this.token("FLOAT", num)
			}

			else if (this.ch() === '"') {
				this.count++
				let str = ""
				while (this.ch() !== '"' && str[-1] !== '\\') {
					str += this.ch()
					this.count++
				}
				res = this.token("STRING", str)
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

				switch (id) {
					case "while":    res = this.token("ST_WHILE",    id); break
					case "if":       res = this.token("ST_IF",       id); break
					case "else":     res = this.token("ST_ELSE",     id); break
					case "break":    res = this.token("LP_BREAK",    id); break
					case "continue": res = this.token("LP_CONTINUE", id); break
					case "extern":   res = this.token("EXTERN",      id); break
					case "return":   res = this.token("RET",         id); break
					default:         res = this.token("ID",          id); break
				}
			}

			else {
				res = this.token(
					"ERR",
					"invalid character",
				)
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
		if (symbol.kind === "VAR") {
			this.cur_func.vars.push(symbol)
		}
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
		if (a.kind !== b.kind) return false
		if (a.kind === "POINTER" || a.kind === "ARRAY") {
			if (a.kind === "ARRAY") {
				if (a.length !== b.length) {
					return false
				}
			}
			return this.compare_types(a.base, b.base);
		}
		return true
	}

	parse_type(need_name) {
		let type = null
		let name = null
		let tp = ""

		if (this.p().kind !== "ID")
			this.error(this.p().line, "aincorrect type")

		switch (this.p().data) {
			case "int":   tp = "INT";   break
			case "float": tp = "FLOAT"; break
			case "void":  tp = "VOID";  break
			case "char":  tp = "CHAR";  break
			default: this.error(this.p().line, "bincorrect type")
		}

		this.n();
		type = { kind: tp }

		while (this.p().kind === "STAR") {
			this.n()
			type = {
				kind: "POINTER",
				base: type,
			}
		}

		if (this.p().kind === "ID" && need_name) {
			name = this.n().data
		}

		while (this.p().kind === "OSQBRA") {
			this.n()
			let expr = this.parse_expr(["CSQBRA"])
			if (expr.kind !== "LIT" || expr.type.kind !== "INT") {
				this.error(this.p().line, "int literal expected")
			}

			type = {
				kind: "ARRAY",
				base: type,
				length: expr.value,
			}
		}

		return { type, name }
	}

	op_bp(kind, r) {
		switch (kind) {
		case "EQ":
			return 1
		case "OR":
			return 2
		case "AND":
			return 3
		case "LESS":
		case "GREATER":
		case "LESS_EQ":
		case "GREATER_EQ":
		case "NOT_EQ":
		case "EQ_EQ":
			return 5
		case "ADD":
		case "SUB":
			return 10
		case "MUL":
		case "DIV":
			return 20
		case "NEG":
		case "NOT":
		case "CAST":
			return r ? -1 : 30
		case "DEREF":
			return r ? -1 : 35
		case "ARR":
			return 40
		}
	}

	tok_unary_op(tok) {
		switch (tok.kind) {
			case "AMP":   return "REF"
			case "STAR":  return "DEREF"
			case "MINUS": return "NEG"
			case "EXT":   return "NOT"
			case "OPAR":  return "CAST"
			default:      return null
		}
	}

	tok_bin_op(tok) {
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
			case "OSQBRA":     return "ARR"
			default:           return null
		}
	}

	pref_func(str) { return `FUNC ${str}`; }
	pref_var(str)  { return `VAR ${str}`;  }

	parse_func_call() {
		let count = 0
		let name = this.n().data
		let args = []
		let line = this.p().line
		let smbl = this.symbol_table_get(
			this.p().line,
			this.pref_func(name))
		let type = smbl.type
		let fargs = smbl.args

		this.expect(this.n(), "OPAR")
		while (this.p().kind !== "CPAR") {
			if (count > fargs.length - 1)
				this.error(_line, "too many arguments")
			let expr = this.expr_num_cast(
				this.parse_expr(["CPAR", "COM"]),
				fargs[count].type)
			args.push(expr)
			this.lexer.count--
			if (this.p().kind === "COM")
				this.n()
			if (!this.compare_types(expr.type, fargs[count].type))
				this.error(line, "types mismatch")
			count++
		}

		if (count < fargs.length)
			this.error(line, "not enough arguments")
		this.n()

		return {
			kind: "CALL_FUNC",
			type, name, line, args
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
		} else if (type.kind === "INT" && num.type.kind === "CHAR") {
			return {
				kind: "EXPR_UN",
				op: "CAST",
				type: { kind: "INT" },
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
				this.error(expr.line, "invalid unary expression")
			}

			if (expr.op === "CAST") {
				this.expr_calc_types(expr.oprd)
				return expr.type
			}

			expr.type = this.expr_calc_types(expr.oprd)
			if (expr.op === "DEREF")
				expr.type = expr.type.base
			return expr.type

		case "EXPR_BIN":
			if (expr.lhs === null || expr.rhs === null)
				this.error(expr.line, "invalid binary expression")
			let lhst = this.expr_calc_types(expr.lhs)
			let rhst = this.expr_calc_types(expr.rhs)
			expr.type = lhst

			if ((lhst.kind === "FLOAT" && rhst.kind === "INT") ||
				(rhst.kind === "FLOAT" && lhst.kind === "INT") && expr.op !== "EQ") {
				expr.type = { kind: "FLOAT" }
				let lhsti = lhst.kind === "INT"
				if (lhsti) expr.lhs = this.expr_num_cast(expr.lhs, rhst)
				else       expr.rhs = this.expr_num_cast(expr.rhs, lhst)
			} else if (
				(lhst.kind === "ARRAY"   && rhst.kind === "INT") ||
				(rhst.kind === "ARRAY"   && lhst.kind === "INT") ||
				(lhst.kind === "POINTER" && rhst.kind === "INT") ||
				(rhst.kind === "POINTER" && lhst.kind === "INT")
			) {
				if (expr.op !== "ADD" && expr.op !== "SUB" && expr.op !== "ARR") {
					this.error(expr.line, "invalid operation")
				}
			} else if (!this.compare_types(lhst, rhst)) {
				this.error(expr.line, "4 types mismatch")
			}

			if (expr.op === "ARR") {
				if (lhst.kind !== "POINTER") {
					if (rhst.kind !== "POINTER")
						this.error(expr.line, "pointer/array expected");
					let tmp = expr.lhs;
					expr.lhs = expr.rhs;
					expr.rhs = tmp;
				}
				expr.type = expr.lhs.type.base
			}

			switch (expr.op) {
			case "OR":      case "AND":
			case "EQ_EQ":   case "NOT_EQ":
			case "LESS":    case "GREATER":
			case "LESS_EQ": case "GREATER_EQ":
				expr.type = { kind: "INT" }
			}

			return expr.type
		}
	}

	// 10 * 5 / 3 + 5
	parse_expr_bp(min_bp, until) {
		let lhs = this.parse_expr_item()
		while (true) {
			if (lhs.kind === "OPERATOR") {
				let cast_type = lhs.type
				let op = this.tok_unary_op(lhs.tok)
				let rbp = this.op_bp(op, false)
				let oprd = this.parse_expr_bp(rbp, until)
				lhs = {
					kind: "EXPR_UN",
					line: lhs.tok.line,
					op, oprd,
					rbp,
				}
				if (op === "CAST") {
					lhs.type = cast_type
				}
			} else {
				if (until.includes(this.p().kind)) break
				let savedCount = this.lexer.count
				let opExpr = this.parse_expr_item()
				if (opExpr.kind !== "OPERATOR")
					this.error(this.p().line, "operator expected")
				let op = this.tok_bin_op(opExpr.tok)
				let lbp = this.op_bp(op, true)
				let rbp = this.op_bp(op, false)
				if (lbp <= min_bp) {
					this.lexer.count = savedCount
					break
				}
				let rhs = null
				if (op === "ARR") {
					rhs = this.parse_expr_bp(0, ["CSQBRA"])
					this.n()
				} else rhs = this.parse_expr_bp(rbp, until)
				lhs = {
					kind: "EXPR_BIN",
					line: opExpr.tok.line,
					op, lhs, rhs
				}
			}
		}
		return lhs
	}

	parse_expr(until) {
		let expr = this.parse_expr_bp(0, until)
		this.n()
		this.expr_calc_types(expr)
		return expr
	}

	parse_expr_item() {
		switch (this.p().kind) {
		case "CHAR":
			return {
				kind: "LIT",
				line: this.p().line,
				type: { kind: "CHAR" },
				lit: "CHAR",
				value: this.n().data.charCodeAt(0),
			}

		case "STRING":
			return {
				kind: "LIT",
				lit: "STRING",
				line: this.p().line,
				data: this.n().data,
				type: {
					kind: "POINTER",
					base: { kind: "CHAR" }
				}
			}

		case "INT":
			return {
				kind: "LIT",
				lit: "INT",
				line: this.p().line,
				type: { kind: "INT" },
				value: this.n().data,
			}

		case "FLOAT":
			return {
				kind: "LIT",
				lit: "FLOAT",
				line: this.p().line,
				type: { kind: "FLOAT" },
				value: this.n().data,
			}

		case "OPAR": {
			let tok = this.n()
			if (this.is_type_next(false)) {
				let line = this.p().line
				let type = this.parse_type(false).type
				this.expect(this.n(), "CPAR")
				return {
					kind: "OPERATOR",
					line, type, tok,
				}
			} else {
				let expr = this.parse_expr_bp(0, ["CPAR"])
				this.n()
				return expr
			}
		} break

		case "ID": {
			if (this.p2().kind != "OPAR") {
				let smbl = this.symbol_table_get(
					this.p().line,
					this.pref_var(this.p().data))
				return {
					kind: "VAR",
					line: this.p().line,
					type: smbl.type,
					id: smbl.id,
					name: this.n().data
				}
			} else {
				return this.parse_func_call()
			}
		} break

		case "OSQBRA":
		case "AMP":
		case "STAR":
		case "MINUS":
		case "EXT":
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
		case "PLUS":
			return {
				kind: "OPERATOR",
				line: this.p().line,
				tok: this.n()
			}

		default:
			this.error(
				this.p().line,
				`invalid operator / operand \`${this.p().data}\``
			)
		}
	}

	parse_def_var() {
		let line = this.p().line

		let tan = this.parse_type(true)
		let type = tan.type
		let name = tan.name
		let id = `V${this.var_ind++}`
		let expr = null
		if (this.p().kind === "EQ") {
			this.n()
			expr = this.expr_num_cast(this.parse_expr(["SEMI"]), type)
			if (!this.compare_types(type, expr.type)) {
				this.error(line, "1 types mismatch")
			}
		} else {
			this.expect(this.n(), "SEMI")
		}
		this.symbol_table_add(line, name, {
			kind: "VAR", type, id
		})
		return {
			kind: "DEF_VAR",
			type, name, id, expr,
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
		let expr = null
		if (this.p().kind !== "SEMI") {
			expr = this.expr_num_cast(
				this.parse_expr(["SEMI"]),
				this.cur_func.type
			)
		}
		if (!this.compare_types(this.cur_func.type, expr.type))
			this.error(line, "2 types mismatch")
		return {
			kind: "RET",
			type: expr.type,
			expr
		}
	}

	parse_st_if() {
		this.n()

		this.expect(this.n(), "OPAR")
		let cond = this.parse_expr(["CPAR"])
		let body = this.parse_body(false)

		let st_if = {
			kind: "ST_IF",
			cond, body,
			next: null,
		}

		if (this.p().kind === "ST_ELSE") {
			if (this.p2().kind == "ST_IF") {
				this.n()
				st_if.next = this.parse_st_if()
			} else {
				this.n()
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
		let cond = this.parse_expr(["CPAR"])
		let body = this.parse_body(false)

		return {
			kind: "ST_WHILE",
			cond, body,
		}
	}

	parse_body(skip_push) {
		this.expect(this.n(), "OBRA")
		let body = []
		if (!skip_push) this.push_scope()

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
			} else if (this.p().kind == "LP_CONTINUE") {
				body.push({kind: "LP_CONTINUE"})
				this.n(); this.expect(this.n(), "SEMI")
			} else body.push(this.parse_mut_var())
		}

		if (!skip_push) this.pop_scope()
		this.n()
		return body
	}

	parse_def_func(is_extern) {
		let type = this.parse_type(false).type

		this.expect(this.p(), "ID")
		let name = this.n().data

		this.expect(this.n(), "OPAR")
		let args = []

		while (this.p().kind !== "CPAR") {
			if (this.p().kind == "COM") {
				this.n()
			} else if (this.p().kind == "ID") {
				let type = this.parse_type(false).type
				this.expect(this.p(), "ID")
				let name = this.n().data
				args.push({
					type: type,
					name: name,
					id: `V${this.var_ind++}`
				})
			} else {
				this.expect(this.p(), "COM")
			}
		}

		this.n()

		let func = {
			kind: "DEF_FUNC",
			type, name, args,
			vars: [],
		}

		this.cur_func = func
		this.symbol_table_add(this.p().line, name, {
			kind: "FUNC",
			type, args,
		})

		if (is_extern) {
			this.externs.push({
				type: type,
				name, args,
			})
		}

		if (!is_extern) {
			this.push_scope()

			args.forEach((arg) => {
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
			if (this.is_type_next(true)) {
				this.prog.body.push(this.parse_def_func(false))
				// TODO: Global variables
				// this.prog.body.push(this.parse_def_var())
			} else {
				if (this.p().kind == "EXTERN") {
					this.n()
					this.parse_def_func(true)
				} else {
					this.error(this.p().line, "invalid high level declaration")
				}
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
		this.str_lits = new Map(),
		this.str_lit_mem = 32
		this.parser = parser
	}

	emit(text) {
		for (let i = 0; i < this.intend; i++)
			this.code += "    "
		this.code += text + "\n"
	}

	type_size(type) {
		switch (type.kind) {
		case "POINTER":
		case "INT":
		case "FLOAT":
			return 4
		case "CHAR":
			return 1
		}
	}

	wat_type(type) {
		switch (type.kind) {
		case "POINTER":
		case "ARRAY":
		case "INT":
		case "CHAR":
			return "i32"
		case "FLOAT":
			return "f32"
		}
	}

	emit_expr(expr) {
		switch (expr.kind) {
		case "LIT":
			if (expr.lit === "STRING") {
				this.emit(`i32.const ${this.str_lit_mem}`)
				this.str_lits.set(this.str_lit_mem, expr.data)
				this.str_lit_mem += expr.data.length
			} else this.emit(`${this.wat_type(expr.type)}.const ${expr.value}`)
			break

		case "CALL_FUNC":
			expr.args.forEach((it) => { this.emit_expr(it) })
			this.emit(`call \$${expr.name}`)
			break

		case "VAR":
			this.emit(`local.get \$${expr.id}`)
			break

		case "EXPR_UN": {
			let wt = this.wat_type(expr.type)
			if (expr.op === "CAST") {
				this.emit_expr(expr.oprd)
				if (expr.type.kind === "POINTER") return
				if (!this.parser.compare_types(expr.type, expr.oprd.type)) {
					switch (expr.oprd.type.kind) {
						case "INT":   this.emit(`${wt}.convert_i32_s`); break
						case "FLOAT": this.emit(`${wt}.trunc_f32_s`);   break
					}
				}
				return
			}
			switch (expr.op) {
			case "DEREF": {
				this.emit_expr(expr.oprd)
				if (expr.type.kind === "CHAR") {
					this.emit(`${wt}.load8_s`)
				} else {
					this.emit(`${wt}.load`)
				}
			} break
			case "NEG": {
				switch (expr.type.kind) {
				case "INT": {
					this.emit("i32.const 0")
					this.emit_expr(expr.oprd)
					this.emit(`${wt}.sub`)
				} break
				case "FLOAT":
					this.emit_expr(expr.oprd)
					this.emit(`${wt}.neg`)
				}
			} break
			case "NOT":
				this.emit(`${wt}.eqz`)
			}
		} break

		case "EXPR_BIN":
			if (expr.op === "EQ") {
				let wt = this.wat_type(expr.type)
				if (expr.lhs.kind !== "VAR") {
					if (expr.lhs.op === "ARR") {
						this.emit_expr(expr.lhs.lhs)
						this.emit_expr(expr.lhs.rhs)
						this.emit(`${wt}.const ${
							this.type_size(expr.lhs.lhs.type.base)
						}`)
						this.emit(`${wt}.mul`)
						this.emit(`${wt}.add`)
					} else if (expr.lhs.op === "DEREF") {
						this.emit_expr(expr.lhs.oprd)
					} else this.emit_expr(expr.lhs)
				}
				this.emit_expr(expr.rhs)
				if (expr.lhs.kind !== "VAR") {
					if (expr.type.kind === "CHAR") {
						this.emit(`${wt}.store8`)
					} else {
						this.emit(`${wt}.store`)
					}
				} else {
					this.emit(`local.set \$${expr.lhs.id}`)
				}
				return
			}

			this.emit_expr(expr.lhs)
			this.emit_expr(expr.rhs)

			let wt = this.wat_type(expr.type)
			let lt = expr.lhs.type

			switch (expr.op) {
			case "ADD":    this.emit(`${wt}.add`); break
			case "SUB":    this.emit(`${wt}.sub`); break
			case "MUL":    this.emit(`${wt}.mul`); break
			case "EQ_EQ":  this.emit(`${wt}.eq`);  break
			case "NOT_EQ": this.emit(`${wt}.ne`);  break
			case "AND":    this.emit(`${wt}.and`); break
			case "OR":     this.emit(`${wt}.or`);  break

			case "ARR":
				this.emit(`${wt}.const ${
					this.type_size(expr.lhs.type.base)
				}`)
				this.emit(`${wt}.mul`)
				this.emit(`${wt}.add`)
				if (expr.type.kind === "CHAR") {
					this.emit(`${wt}.load8_s`)
				} else {
					this.emit(`${wt}.load`)
				} break

			case "DIV":
				switch (lt.kind) {
					case "INT":   this.emit(`i32.div_s`); break
					case "FLOAT": this.emit(`f32.div`);   break
				} break

			case "LESS":
				switch (lt.kind) {
					case "INT":   this.emit(`i32.lt_s`); break
					case "FLOAT": this.emit(`f32.lt`);   break
				} break

			case "GREATER":
				switch (lt.kind) {
					case "INT":   this.emit(`i32.gt_s`); break
					case "FLOAT": this.emit(`f32.gt`);   break
				} break

			case "LESS_EQ":
				switch (lt.kind) {
					case "INT":   this.emit(`i32.le_s`); break
					case "FLOAT": this.emit(`f32.le`);   break
				} break

			case "GREATER_EQ":
				switch (lt.kind) {
					case "INT":   this.emit(`i32.ge_s`); break
					case "FLOAT": this.emit(`f32.ge`);   break
				} break
			}
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
			case "MUT_VAR":  this.emit_mut_var    (it); break
			case "ST_IF":    this.emit_st_if      (it); break
			case "ST_WHILE": this.emit_st_while   (it); break
			case "RET":      this.emit_func_ret   (it); break

			case "LP_BREAK":
				this.emit(`br \$WO${this.loop_ind}`)
				break

			case "LP_CONTINUE":
				this.emit(`br \$WI${this.loop_ind}`)
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

		this.emit("(memory 10)")

		this.parser.prog.body.forEach((it) => {
			if (it.kind === "DEF_FUNC") {
				this.emit_def_func(it)
			}
		})

		this.str_lits.forEach((val, mem) => {
			val += "\\00"
			this.emit(`(data (i32.const ${mem}) "${val}")`)
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
