import {
  constructErrorByName,
  ParseError
} from "../Errors";
import {
  Formulas
} from "../Formulas";
import {
  Symbol
} from "./Symbols";
import {
  ReduceActions
} from "./ReduceActions";
import {
  ReductionPair
} from "./ReductionPair";
import {
  RuleIndex
} from "./RuleIndex";
import {
  ACTION_TABLE,
  RULES,
  REDUCE,
  ACCEPT,
  SHIFT,
  SYMBOL_INDEX_TO_NAME,
  SYMBOL_NAME_TO_INDEX,
  PRODUCTIONS
} from "./ParserConstants"
import {
  isArray,
  isUndefined,
  string
} from "../Utilities/MoreUtils";
import {TypeConverter} from "../Utilities/TypeConverter";
import {
  DIVIDE,
  EQ,
  GT,
  GTE,
  LT,
  LTE,
  MINUS,
  MULTIPLY,
  POWER,
  SUM
} from "../Formulas/Math";

let Parser = (function () {
  let parser = {
    lexer: undefined,
    Parser: undefined,
    trace: function trace() {},
    yy: {},
    /**
     * Perform a reduce action on the given virtual stack. Basically, fetching, deriving, or calculating a value.
     * @param rawValueOfReduceOriginToken - Some actions require the origin token to perform a reduce action. For
     * example, when reducing the cell reference A1 to it's actual value this value would be "A1".
     * @param sharedStateYY - the shared state that has all helpers, and current working object.
     * @param reduceActionToPerform - the ReduceAction to perform with the current virtual stack. Since this function
     * is only called in one place, this should always be action[1] in that context.
     * @param virtualStack - Array of values to use in action.
     * @param catchOnFailure - If we are performing an action that could result in a failure, and we cant to catch and
     * assign the error thrown, this should be set to true.
     * @returns {number|boolean|string}
     */
    performAction: function (rawValueOfReduceOriginToken, sharedStateYY, reduceActionToPerform, virtualStack : Array<any>, catchOnFailure : boolean) {
      // For context, this function is only called with `apply`, so `this` is `yyval`.

      const vsl = virtualStack.length - 1;
      try {
        switch (reduceActionToPerform) {
          case ReduceActions.ReturnLast:
            return virtualStack[vsl - 1];
          case ReduceActions.CallVariable:
            this.$ = sharedStateYY.handler.callVariable.call(this, virtualStack[vsl]);
            break;
          case ReduceActions.AsNumber:
            this.$ = TypeConverter.valueToNumber(virtualStack[vsl]);
            break;
          case ReduceActions.AsString:
            this.$ = string(virtualStack[vsl]);
            break;
          case ReduceActions.Ampersand:
            this.$ = TypeConverter.valueToString(virtualStack[vsl - 2]) + TypeConverter.valueToString(virtualStack[vsl]);
            break;
          case ReduceActions.Equals:
            this.$ = EQ(virtualStack[vsl - 2], virtualStack[vsl]);
            break;
          case ReduceActions.Plus:
            this.$ = SUM(virtualStack[vsl - 2], virtualStack[vsl]);
            break;
          case ReduceActions.LastExpression:
            this.$ = virtualStack[vsl - 1];
            break;
          case ReduceActions.LTE:
            this.$ = LTE(virtualStack[vsl - 3], virtualStack[vsl]);
            break;
          case ReduceActions.GTE:
            this.$ = GTE(virtualStack[vsl - 3], virtualStack[vsl]);
            break;
          case ReduceActions.NotEqual:
            this.$ = !EQ(virtualStack[vsl - 3], virtualStack[vsl]);
            break;
          case ReduceActions.GT:
            this.$ = GT(virtualStack[vsl - 2], virtualStack[vsl]);
            break;
          case ReduceActions.LT:
            this.$ = LT(virtualStack[vsl - 2], virtualStack[vsl]);
            break;
          case ReduceActions.Minus:
            this.$ = MINUS(virtualStack[vsl - 2], virtualStack[vsl]);
            break;
          case ReduceActions.Multiply:
            this.$ = MULTIPLY(virtualStack[vsl - 2], virtualStack[vsl]);
            break;
          case ReduceActions.Divide:
            this.$ = DIVIDE(virtualStack[vsl - 2], virtualStack[vsl]);
            break;
          case ReduceActions.ToPower:
            this.$ = POWER(virtualStack[vsl - 2], virtualStack[vsl]);
            break;
          case ReduceActions.InvertNumber:
            this.$ = TypeConverter.valueToInvertedNumber(virtualStack[vsl]);
            if (isNaN(this.$)) {
              this.$ = 0;
            }
            break;
          case ReduceActions.ToNumberNANAsZero:
            this.$ = TypeConverter.valueToNumber(virtualStack[vsl]);
            if (isNaN(this.$)) {
              this.$ = 0;
            }
            break;
          case ReduceActions.CallFunctionLastBlank:
            this.$ = sharedStateYY.handler.callFunction.call(this, virtualStack[vsl - 2], '');
            break;
          case ReduceActions.CallFunctionLastTwoInStack:
            this.$ = sharedStateYY.handler.callFunction.call(this, virtualStack[vsl - 3], virtualStack[vsl - 1]);
            break;
          case ReduceActions.FixedCellValue:
            this.$ = sharedStateYY.handler.fixedCellValue(sharedStateYY.originCellId, virtualStack[vsl]);
            break;
          case ReduceActions.FixedCellRangeValue:
            this.$ = sharedStateYY.handler.fixedCellRangeValue(sharedStateYY.originCellId, virtualStack[vsl - 2], virtualStack[vsl]);
            break;
          case ReduceActions.CellValue:
            this.$ = sharedStateYY.handler.cellValue(sharedStateYY.originCellId, virtualStack[vsl]);
            break;
          case ReduceActions.CellRangeValue:
            this.$ = sharedStateYY.handler.cellRangeValue(sharedStateYY.originCellId, virtualStack[vsl - 2], virtualStack[vsl]);
            break;
          case ReduceActions.EnsureIsArray:
            if (isArray(virtualStack[vsl])) {
              this.$ = virtualStack[vsl];
            } else {
              this.$ = [virtualStack[vsl]];
            }
            break;
          case ReduceActions.EnsureYYTextIsArray:
            let result = [],
              arr = eval("[" + rawValueOfReduceOriginToken + "]");
            arr.forEach(function (item) {
              result.push(item);
            });
            this.$ = result;
            break;
          case ReduceActions.ReduceInt:
          case ReduceActions.ReducePercent:
            virtualStack[vsl - 2].push(virtualStack[vsl]);
            this.$ = virtualStack[vsl - 2];
            break;
          case ReduceActions.WrapCurrentTokenAsArray:
            this.$ = [virtualStack[vsl]];
            break;
          case ReduceActions.EnsureLastTwoINArrayAndPush:
            this.$ = (isArray(virtualStack[vsl - 2]) ? virtualStack[vsl - 2] : [virtualStack[vsl - 2]]);
            this.$.push(virtualStack[vsl]);
            break;
          case ReduceActions.ReflexiveReduce:
            this.$ = virtualStack[vsl];
            break;
          case ReduceActions.ReduceFloat:
            this.$ = TypeConverter.valueToNumber(virtualStack[vsl - 2] + '.' + virtualStack[vsl]);
            break;
          case ReduceActions.ReducePrevAsPercent:
            this.$ = virtualStack[vsl - 1] * 0.01;
            break;
          case ReduceActions.ReduceLastThreeA:
          case ReduceActions.ReduceLastThreeB:
            this.$ = virtualStack[vsl - 2] + virtualStack[vsl - 1] + virtualStack[vsl];
            break;
          case ReduceActions.AsError:
            this.$ = constructErrorByName(virtualStack[vsl]);
            break;
        }
      } catch (e) {
        if (catchOnFailure) {
          // NOTE: I'm not sure if some of these ReduceAction map correctly in the case of an error.
          switch (reduceActionToPerform) {
            case ReduceActions.ReturnLast:
              return virtualStack[vsl - 1];
            case ReduceActions.CallVariable:
            case ReduceActions.AsNumber:
            case ReduceActions.AsString:
            case ReduceActions.Ampersand:
            case ReduceActions.Equals:
            case ReduceActions.Plus:
            case ReduceActions.LastExpression:
            case ReduceActions.LTE:
            case ReduceActions.GTE:
            case ReduceActions.NotEqual:
            case ReduceActions.GT:
            case ReduceActions.LT:
            case ReduceActions.Minus:
            case ReduceActions.Multiply:
            case ReduceActions.Divide:
            case ReduceActions.ToPower:
            case ReduceActions.CallFunctionLastBlank:
            case ReduceActions.CallFunctionLastTwoInStack:
            case ReduceActions.FixedCellValue:
            case ReduceActions.FixedCellRangeValue:
            case ReduceActions.CellValue:
            case ReduceActions.CellRangeValue:
              this.$ = e;
              break;
            case ReduceActions.InvertNumber:
              this.$ = e;
              if (isNaN(this.$)) {
                this.$ = 0;
              }
              break;
            case ReduceActions.ToNumberNANAsZero:
              this.$ = e;
              if (isNaN(this.$)) {
                this.$ = 0;
              }
              break;
            case ReduceActions.EnsureIsArray:
              if (isArray(virtualStack[vsl])) {
                this.$ = virtualStack[vsl];
              } else {
                this.$ = [virtualStack[vsl]];
              }
              break;
            case ReduceActions.EnsureYYTextIsArray:
              let result = [],
                arr = eval("[" + rawValueOfReduceOriginToken + "]");
              arr.forEach(function (item) {
                result.push(item);
              });
              this.$ = result;
              break;
            case ReduceActions.ReduceInt:
            case ReduceActions.ReducePercent:
              virtualStack[vsl - 2].push(virtualStack[vsl]);
              this.$ = virtualStack[vsl - 2];
              break;
            case ReduceActions.WrapCurrentTokenAsArray:
              this.$ = [virtualStack[vsl]];
              break;
            case ReduceActions.EnsureLastTwoINArrayAndPush:
              this.$ = (isArray(virtualStack[vsl - 2]) ? virtualStack[vsl - 2] : [virtualStack[vsl - 2]]);
              this.$.push(virtualStack[vsl]);
              break;
            case ReduceActions.ReflexiveReduce:
              this.$ = virtualStack[vsl];
              break;
            case ReduceActions.ReduceFloat:
              this.$ = parseFloat(virtualStack[vsl - 2] + '.' + virtualStack[vsl]);
              break;
            case ReduceActions.ReducePrevAsPercent:
              this.$ = virtualStack[vsl - 1] * 0.01;
              break;
            case ReduceActions.ReduceLastThreeA:
            case ReduceActions.ReduceLastThreeB:
              this.$ = virtualStack[vsl - 2] + virtualStack[vsl - 1] + virtualStack[vsl];
              break;
          }
        } else {
          throw e;
        }
      }
    },
    defaultActions: {19: [REDUCE, ReduceActions.ReturnLast]},
    parseError: function parseError(str, hash) {
      if (hash.recoverable) {
        this.trace(str);
      } else {
        throw new ParseError(str);
      }
    },
    parse: function parse(input) {
      let stack = [0],
        semanticValueStack = [null],
        locationStack = [],
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

      let args = locationStack.slice.call(arguments, 1);
      let lexer = Object.create(this.lexer);
      let sharedState = {
        yy: {
          parseError: undefined,
          lexer: {
            parseError: undefined
          },
          parser: {
            parseError: undefined
          }
        }
      };
      // copy state
      for (let k in this.yy) {
        if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
          sharedState.yy[k] = this.yy[k];
        }
      }

      lexer.setInput(input, sharedState.yy);
      sharedState.yy.lexer = lexer;
      sharedState.yy.parser = this;
      if (typeof lexer.yylloc == 'undefined') {
        lexer.yylloc = {};
      }
      let yyloc = lexer.yylloc;
      locationStack.push(yyloc);

      let ranges = lexer.options && lexer.options.ranges;

      if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
      } else {
        this.parseError = Object.getPrototypeOf(this).parseError;
      }

      function popStack(n) {
        stack.length = stack.length - 2 * n;
        semanticValueStack.length = semanticValueStack.length - n;
        locationStack.length = locationStack.length - n;
      }

      function lex() {
        let token = lexer.lex() || EOF;
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
          token = SYMBOL_NAME_TO_INDEX[token] || token;
        }
        return token;
      }

      let symbol,
        preErrorSymbol,
        state,
        action,
        result,
        yyval = {
          $: undefined,
          _$: undefined
        },
        p,
        newState,
        expected,
        catchFailuresOn = false;
      while (true) {
        // retrieve state number from top of stack
        state = stack[stack.length - 1];

        // use default actions if available
        if (this.defaultActions[state]) {
          action = this.defaultActions[state];
        } else {
          if (typeof symbol == 'undefined'|| symbol === null) {
            symbol = lex();
          }
          // read action for current state and first input
          action = ACTION_TABLE[state] && ACTION_TABLE[state][symbol];
        }

        // console.log({
        //   text: lexer.match,
        //   token: SYMBOL_INDEX_TO_NAME[symbol] || symbol,
        //   tokenIndex: symbol,
        //   line: lexer.yylineno,
        //   loc: yyloc,
        //   state: state,
        //   stack: stack,
        //   semanticValueStack: semanticValueStack
        // });

        // handle parse error
        if (typeof action === 'undefined' || !action.length || !action[0]) {
          let error_rule_depth;
          let errStr = '';

          // Return the rule stack depth where the nearest error rule can be found.
          // Return FALSE when no error recovery rule was found.
          this.locateNearestErrorRecoveryRule = function(state) {
            let stack_probe = stack.length - 1;
            let depth = 0;

            // try to recover from error
            for (; ;) {
              if (isUndefined(state)) {
                return false;
              }
              // check for error recovery rule in this state
              if ((TERROR.toString()) in ACTION_TABLE[state]) {
                return depth;
              }
              if (state === 0 || stack_probe < 2) {
                return false; // No suitable error recovery rule available.
              }
              stack_probe -= 2; // popStack(1): [symbol, action]
              state = stack[stack_probe];
              ++depth;
            }
          };

          if (!recovering) {
            // first see if there's any chance at hitting an error recovery rule:
            error_rule_depth = this.locateNearestErrorRecoveryRule(state);

            // Report error
            expected = [];
            let expectedIndexes = [];
            let tableState = ACTION_TABLE[state];
            for (p in ACTION_TABLE[state]) {
              if (SYMBOL_INDEX_TO_NAME[p] && p > TERROR) {
                expected.push(SYMBOL_INDEX_TO_NAME[p]);
                expectedIndexes.push(p);
              }
            }
            if (lexer.showPosition) {
              errStr = 'Parse error on line ' + (yylineno + 1) + ":  " + lexer.showPosition() + "  Expecting " + expected.join(', ') + ", got '" + (SYMBOL_INDEX_TO_NAME[symbol] || symbol) + "'";
            } else {
              errStr = 'Parse error on line ' + (yylineno + 1) + ": Unexpected " +
                (symbol == EOF ? "end of input" :
                  ("'" + (SYMBOL_INDEX_TO_NAME[symbol] || symbol) + "'"));
            }
            this.parseError(errStr, {
              text: lexer.match,
              token: SYMBOL_INDEX_TO_NAME[symbol] || symbol,
              tokenIndex: symbol,
              line: lexer.yylineno,
              loc: yyloc,
              expected: expected,
              expectedIndexes: expectedIndexes,
              state: state,
              tableState: tableState,
              stack: stack,
              semanticValueStack: semanticValueStack,
              recoverable: (error_rule_depth !== false)
            });
          } else if (preErrorSymbol !== EOF) {
            error_rule_depth = this.locateNearestErrorRecoveryRule(state);
          }

          // just recovered from another error
          if (recovering == 3) {
            if (symbol === EOF || preErrorSymbol === EOF) {
              throw new ParseError(errStr || 'Parsing halted while starting to recover from another error.');
            }

            // discard current lookahead and grab another
            yyleng = lexer.yyleng;
            yytext = lexer.yytext;
            yylineno = lexer.yylineno;
            yyloc = lexer.yylloc;
            symbol = lex();
          }

          // try to recover from error
          if (error_rule_depth === false) {
            throw new ParseError(errStr || 'Parsing halted. No suitable error recovery rule available.');
          }
          popStack(error_rule_depth);

          preErrorSymbol = (symbol == TERROR ? null : symbol); // save the lookahead token
          symbol = TERROR;         // insert generic error symbol as new lookahead
          state = stack[stack.length - 1];
          action = ACTION_TABLE[state] && ACTION_TABLE[state][TERROR];
          recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
        }

        // this shouldn't happen, unless resolve defaults are off
        if (action[0] instanceof Array && action.length > 1) {
          throw new ParseError('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol);
        }

        // Available actions:
        //   Shift: continue to process tokens.
        //   Reduce: enough tokens have been gathered to reduce input through evaluation.
        //   Accept: return.
        switch (action[0]) {
          case SHIFT: // Shift
            stack.push(symbol);
            semanticValueStack.push(lexer.yytext);
            locationStack.push(lexer.yylloc);
            stack.push(action[1]); // push state
            // console.log("SHIFT", "literal", lexer.yytext, "   symbol", symbol, "   symbol name", SYMBOL_INDEX_TO_NAME[symbol], "   action", action,
            //     "   stack", stack, "   semanticValueStack", semanticValueStack);
            symbol = null;

            if (Formulas.isTryCatchFormula(lexer.yytext)) {
              catchFailuresOn = true;
            }

            if (!preErrorSymbol) { // normal execution/no error
              yyleng = lexer.yyleng;
              yytext = lexer.yytext;
              yylineno = lexer.yylineno;
              yyloc = lexer.yylloc;
              if (recovering > 0) {
                recovering--;
              }
            } else {
              // error just occurred, resume old lookahead f/ before error
              symbol = preErrorSymbol;
              preErrorSymbol = null;
            }
            break;

          case REDUCE: // Reduce
            // console.log("REDUCE", "literal", lexer.yytext, "   symbol", symbol, "   symbol name", SYMBOL_INDEX_TO_NAME[symbol], "   action", action,
            //     "   stack", stack, "   semanticValueStack", semanticValueStack);
            let currentProduction : ReductionPair = PRODUCTIONS[action[1]];

            let lengthToReduceStackBy = currentProduction.getLengthToReduceStackBy();

            // perform semantic action
            yyval.$ = semanticValueStack[semanticValueStack.length - lengthToReduceStackBy]; // default to $$ = $1
            // default location, uses first token for firsts, last for lasts
            yyval._$ = {
              first_line: locationStack[locationStack.length - (lengthToReduceStackBy || 1)].first_line,
              last_line: locationStack[locationStack.length - 1].last_line,
              first_column: locationStack[locationStack.length - (lengthToReduceStackBy || 1)].first_column,
              last_column: locationStack[locationStack.length - 1].last_column
            };
            if (ranges) {
              yyval._$.range = [locationStack[locationStack.length - (lengthToReduceStackBy || 1)].range[0], locationStack[locationStack.length - 1].range[1]];
            }
            // If we are inside of a formula that should catch errors, then catch and return them.
            result = this.performAction.apply(yyval, [yytext, sharedState.yy, action[1], semanticValueStack, catchFailuresOn].concat(args));

            if (typeof result !== 'undefined') {
              return result;
            }

            // pop off stack
            if (lengthToReduceStackBy) {
              stack = stack.slice(0, -1 * lengthToReduceStackBy * 2);
              semanticValueStack = semanticValueStack.slice(0, -1 * lengthToReduceStackBy);
              locationStack = locationStack.slice(0, -1 * lengthToReduceStackBy);
            }

            // push non-terminal (reduce)
            stack.push(currentProduction.getReplacementSymbol());
            semanticValueStack.push(yyval.$);
            locationStack.push(yyval._$);
            newState = ACTION_TABLE[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;

          case ACCEPT:
            // Accept
            return true;
        }

      }
    }
  };

  parser.lexer = (function () {
    return ({
      EOF: 1,

      parseError: function parseError(str, hash) {
        if (this.yy.parser) {
          this.yy.parser.parseError(str, hash);
        } else {
          throw new ParseError(str);
        }
      },

      // resets the lexer, sets new input
      setInput: function (input, yy) {
        this.yy = yy || this.yy || {};
        this.yy.parseError = function (str, hash) {
          throw new ParseError(JSON.stringify({
            name: 'Parser error',
            message: str,
            prop: hash
          }));
        };
        this._input = input;
        this._more = this._backtrack = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {
          first_line: 1,
          first_column: 0,
          last_line: 1,
          last_column: 0
        };
        if (this.options.ranges) {
          this.yylloc.range = [0, 0];
        }
        this.offset = 0;
        return this;
      },

      // consumes and returns one char from the input
      input: function () {
        let ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        let lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
          this.yylineno++;
          this.yylloc.last_line++;
        } else {
          this.yylloc.last_column++;
        }
        if (this.options.ranges) {
          this.yylloc.range[1]++;
        }

        this._input = this._input.slice(1);
        return ch;
      },

      // unshifts one char (or a string) into the input
      unput: function (ch) {
        let len = ch.length;
        let lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        //this.yyleng -= len;
        this.offset -= len;
        let oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - 1);
        this.matched = this.matched.substr(0, this.matched.length - 1);

        if (lines.length - 1) {
          this.yylineno -= lines.length - 1;
        }
        let r = this.yylloc.range;

        this.yylloc = {
          first_line: this.yylloc.first_line,
          last_line: this.yylineno + 1,
          first_column: this.yylloc.first_column,
          last_column: lines ?
            (lines.length === oldLines.length ? this.yylloc.first_column : 0)
            + oldLines[oldLines.length - lines.length].length - lines[0].length :
            this.yylloc.first_column - len
        };

        if (this.options.ranges) {
          this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        this.yyleng = this.yytext.length;
        return this;
      },

      // When called from action, caches matched text and appends it on next action
      more: function () {
        this._more = true;
        return this;
      },

      // displays already matched input, i.e. for error messages
      pastInput: function () {
        let past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...' : '') + past.substr(-20).replace(/\n/g, "");
      },

      // displays upcoming input, i.e. for error messages
      upcomingInput: function () {
        let next = this.match;
        if (next.length < 20) {
          next += this._input.substr(0, 20 - next.length);
        }
        return (next.substr(0, 20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
      },

      // displays the character position where the lexing error occurred, i.e. for error messages
      showPosition: function () {
        let pre = this.pastInput();
        let c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c + "^";
      },

      // test the lexed token: return FALSE when not a match, otherwise return token
      testMatch: function (match, indexed_rule) {
        let token,
          lines,
          backup;

        if (this.options.backtrack_lexer) {
          // save context
          backup = {
            yylineno: this.yylineno,
            yylloc: {
              first_line: this.yylloc.first_line,
              last_line: this.last_line,
              first_column: this.yylloc.first_column,
              last_column: this.yylloc.last_column
            },
            yytext: this.yytext,
            match: this.match,
            matches: this.matches,
            matched: this.matched,
            yyleng: this.yyleng,
            offset: this.offset,
            _more: this._more,
            _input: this._input,
            yy: this.yy,
            conditionStack: this.conditionStack.slice(0),
            done: this.done
          };
          if (this.options.ranges) {
            backup.yylloc.range = this.yylloc.range.slice(0);
          }
        }

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
          this.yylineno += lines.length;
        }
        this.yylloc = {
          first_line: this.yylloc.last_line,
          last_line: this.yylineno + 1,
          first_column: this.yylloc.last_column,
          last_column: lines ?
            lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
            this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
          this.yylloc.range = [this.offset, this.offset += this.yyleng];
        }
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
        token = this.mapRuleIndexToSymbolEnumeration(indexed_rule);
        if (this.done && this._input) {
          this.done = false;
        }
        if (token) {
          return token;
        } else if (this._backtrack) {
          // recover context
          for (let k in backup) {
            this[k] = backup[k];
          }
          return false; // rule action called reject() implying the next rule should be tested instead.
        }
        return false;
      },

      // return next match in input
      next: function () {
        if (this.done) {
          return this.EOF;
        }
        if (!this._input) {
          this.done = true;
        }

        let token,
          match,
          tempMatch,
          index;
        if (!this._more) {
          this.yytext = '';
          this.match = '';
        }
        let rules = this._currentRules();
        for (let i = 0; i < rules.length; i++) {
          tempMatch = this._input.match(RULES[rules[i]]);
          if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
            match = tempMatch;
            index = i;
            if (this.options.backtrack_lexer) {
              token = this.testMatch(tempMatch, rules[i]);
              if (token !== false) {
                return token;
              } else if (this._backtrack) {
                match = false;
                // rule action called reject() implying a rule mis-match.
                // implied `continue`
              } else {
                // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                return false;
              }
            } else if (!this.options.flex) {
              break;
            }
          }
        }
        if (match) {
          token = this.testMatch(match, rules[index]);
          if (token !== false) {
            return token;
          }
          // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
          return false;
        }
        if (this._input === "") {
          return this.EOF;
        } else {
          return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
            text: "",
            token: null,
            line: this.yylineno
          });
        }
      },

      // return next match that has a token
      lex: function lex() {
        let r = this.next();
        if (r) {
          return r;
        } else {
          return this.lex();
        }
      },

      // produce the lexer rule set which is active for the currently active lexer condition state
      _currentRules: function _currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
          return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
          return this.conditions.INITIAL.rules;
        }
      },

      options: {
        // backtrack_lexer?
        // ranges?
        // flex?
      },

      mapRuleIndexToSymbolEnumeration: function (ruleIndex) {
        switch (ruleIndex) {
          case RuleIndex.WhiteSpace:
            // skip whitespace
            break;
          case RuleIndex.DoubleQuotes:
            return Symbol.String;
          case RuleIndex.SingleQuotes:
            return Symbol.String;
          case RuleIndex.FormulaName:
            return Symbol.Function;
          case RuleIndex.$A1Cell:
            return Symbol.FixedCell;
          case RuleIndex.A1Cell:
            return Symbol.CellUpper;
          case RuleIndex.FormulaNameSimple:
            return Symbol.Function;
          case RuleIndex.Variable:
            return Symbol.Variable;
          case RuleIndex.SimpleVariable:
            return Symbol.Variable;
          case RuleIndex.Integer:
            return Symbol.NumberUpper;
          case RuleIndex.SelfContainedArray:
            return Symbol.Array;
          case RuleIndex.DollarSign:
            // skip whitespace??
            break;
          case RuleIndex.Ampersand:
            return Symbol.Ampersand;
          case RuleIndex.SingleWhitespace:
            return ' ';
          case RuleIndex.Period:
            return Symbol.Decimal;
          case RuleIndex.Colon:
            return Symbol.Colon;
          case RuleIndex.Semicolon:
            return Symbol.Semicolon;
          case RuleIndex.Comma:
            return Symbol.Comma;
          case RuleIndex.Asterisk:
            return Symbol.Asterisk;
          case RuleIndex.ForwardSlash:
            return Symbol.Divide;
          case RuleIndex.Minus:
            return Symbol.Minus;
          case RuleIndex.Plus:
            return Symbol.Plus;
          case RuleIndex.Caret:
            return Symbol.Carrot;
          case RuleIndex.OpenParen:
            return Symbol.LeftParen;
          case RuleIndex.CloseParen:
            return Symbol.RightParen;
          case RuleIndex.GreaterThan:
            return Symbol.GreaterThan;
          case RuleIndex.LessThanSign:
            return Symbol.LessThan;
          case RuleIndex.OpenDoubleQuote:
            return '"';
          case RuleIndex.OpenSingleQuote:
            return "'";
          case RuleIndex.ExclamationPoint:
            return "!";
          case RuleIndex.Equals:
            return Symbol.Equals;
          case RuleIndex.Percent:
            return Symbol.Percent;
          case RuleIndex.FullError:
            return Symbol.FullError;
          case RuleIndex.EndOfString:
            return Symbol.EOF;
        }
      },
      conditions: {
        INITIAL: {
          rules: [
            RuleIndex.WhiteSpace,
            RuleIndex.DoubleQuotes,
            RuleIndex.SingleQuotes,
            RuleIndex.FormulaName,
            RuleIndex.$A1Cell,
            RuleIndex.A1Cell,
            RuleIndex.FormulaNameSimple,
            RuleIndex.Variable,
            RuleIndex.SimpleVariable ,
            RuleIndex.Integer,
            RuleIndex.SelfContainedArray,
            RuleIndex.DollarSign,
            RuleIndex.Ampersand ,
            RuleIndex.SingleWhitespace,
            RuleIndex.Period,
            RuleIndex.Colon,
            RuleIndex.Semicolon,
            RuleIndex.Comma,
            RuleIndex.Asterisk,
            RuleIndex.ForwardSlash,
            RuleIndex.Minus,
            RuleIndex.Plus,
            RuleIndex.Caret,
            RuleIndex.OpenParen,
            RuleIndex.CloseParen,
            RuleIndex.GreaterThan,
            RuleIndex.LessThanSign,
            RuleIndex.OpenDoubleQuote,
            RuleIndex.OpenSingleQuote,
            RuleIndex.ExclamationPoint,
            RuleIndex.Equals,
            RuleIndex.Percent,
            RuleIndex.FullError,
            RuleIndex.EndOfString,
            37
          ],
          "inclusive": true
        }
      }
    });
  })();
  function Parser() {
    this.yy = {};
  }

  Parser.prototype = parser;
  parser.Parser = Parser;
  return new Parser;
})();

/**
 * Creates a new FormulaParser, which parses formulas, and does minimal error handling.
 *
 * @param handler should be a Sheet, since the parser needs access to fixedCellValue, cellValue, cellRangeValue, and
 * fixedCellRangeValue
 * @returns formula parser instance for use with parser.js
 * @constructor
 */
let FormulaParser = function(handler) {
  let formulaLexer = function () {};
  formulaLexer.prototype = Parser.lexer;

  let formulaParser = function () {
    this.lexer = new formulaLexer();
    this.yy = {};
  };

  formulaParser.prototype = Parser;
  let newParser = new formulaParser;
  newParser.yy.handler = handler;
  return newParser;
};

export {
  FormulaParser
}