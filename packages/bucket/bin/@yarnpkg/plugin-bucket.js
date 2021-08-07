/* eslint-disable */
module.exports = {
name: "@yarnpkg/plugin-bucket",
factory: function (require) {
var plugin;plugin=(()=>{"use strict";var e={863:(e,r,t)=>{t.r(r),t.d(r,{default:()=>n});const o=require("@yarnpkg/core");function s(e,r){const{bucketName:t,modifier:s}=function(e){const{selector:r}=o.structUtils.parseRange(e.range);let t=r,s=null;(t.startsWith("^")||t.startsWith("~"))&&(s=t[0],t=t.slice(1));return{bucketName:t,modifier:s}}(e),{topLevelWorkspace:n}=r.project,{buckets:i}=n.manifest.raw;if(null==i||null==i[t])throw new o.ReportError(o.MessageName.UNNAMED,`Bucket ${JSON.stringify(t)} is not registered`);const c=i[t];let a,l;if("string"==typeof c)a=o.structUtils.parseRange(c);else{if("string"!=typeof c.range)throw new o.ReportError(o.MessageName.UNNAMED,"Invalid configuration for bucket "+JSON.stringify(t));a=o.structUtils.parseRange(c.range),l=["~","^"].includes(c.peerModifier)?c.peerModifier:void 0}return s&&(a.selector=`${s}${a.selector}`),null==a.protocol&&(a.protocol=r.project.configuration.get("defaultProtocol")),{descriptor:o.structUtils.makeDescriptor(e,o.structUtils.makeRange(a)),peerModifier:l}}const n={hooks:{beforeWorkspacePacking(e,r){var t,n;console.log("beforeWorkspacePacking");for(const i of["dependencies","devDependencies"])for(const c of e.manifest.getForScope(i).values()){if("bucket:"!==o.structUtils.parseRange(c.range).protocol)continue;const{descriptor:{range:a},peerModifier:l=""}=s(c,e),p=o.structUtils.stringifyIdent(c);if((null===(t=r[i])||void 0===t?void 0:t[p])&&(r[i][p]=a),"devDependencies"===i&&"string"==typeof(null===(n=r.peerDependencies)||void 0===n?void 0:n[p])){const t=e.manifest.getForScope("peerDependencies").get(c.identHash);t&&/^[~^]?\*$/.test(t.range)&&(r.peerDependencies[p]=`${t.range.length>1?t.range[0]:l}${o.structUtils.parseRange(a).selector}`)}}}},resolvers:[class{supportsDescriptor(e){return e.range.startsWith("bucket:")}supportsLocator(){return!1}shouldPersistResolution(){return!1}bindDescriptor(e){return e}getResolutionDependencies(e,r){return r.resolver.getResolutionDependencies(s(e,r).descriptor,r)}async getCandidates(e,r,t){return t.resolver.getCandidates(s(e,t).descriptor,r,t)}getSatisfying(e,r,t){return t.resolver.getSatisfying(s(e,t).descriptor,r,t)}async resolve(e,r){throw new Error("Assertion: locators shouldn't be handled by bucket: resolver")}}]}}},r={};function t(o){if(r[o])return r[o].exports;var s=r[o]={exports:{}};return e[o](s,s.exports,t),s.exports}return t.d=(e,r)=>{for(var o in r)t.o(r,o)&&!t.o(e,o)&&Object.defineProperty(e,o,{enumerable:!0,get:r[o]})},t.o=(e,r)=>Object.prototype.hasOwnProperty.call(e,r),t.r=e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},t(863)})();
return plugin;
}
};