"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
function _menorepo() {
  const data = _interopRequireDefault(require("@yangljjs/menorepo2"));
  _menorepo = function _menorepo() {
    return data;
  };
  return data;
}
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function fun2() {
  (0, _menorepo().default)();
  console.log('I am package 1');
}
var _default = fun2;
exports.default = _default;