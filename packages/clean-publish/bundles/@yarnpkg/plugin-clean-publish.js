/* eslint-disable */
//prettier-ignore
module.exports = {
name: "@yarnpkg/plugin-clean-publish",
factory: function (require) {
"use strict";var plugin=(()=>{var k=Object.defineProperty;var t=Object.getOwnPropertyDescriptor;var c=Object.getOwnPropertyNames;var g=Object.prototype.hasOwnProperty;var n=(o,e)=>{for(var r in e)k(o,r,{get:e[r],enumerable:!0})},s=(o,e,r,l)=>{if(e&&typeof e=="object"||typeof e=="function")for(let p of c(e))!g.call(o,p)&&p!==r&&k(o,p,{get:()=>e[p],enumerable:!(l=t(e,p))||l.enumerable});return o};var a=o=>s(k({},"__esModule",{value:!0}),o);var i={};n(i,{default:()=>d});var d={hooks:{beforeWorkspacePacking(o,e){delete e.scripts,delete e.packageManager,delete e.devDependencies,delete e.resolutions}}};return a(i);})();
return plugin;
}
};
