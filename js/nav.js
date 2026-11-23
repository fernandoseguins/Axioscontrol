// Redesenho da tela atual (definido pelo roteador em main.js).
let fn = () => {};
export const setRerender = (f) => { fn = f; };
export const rerender = () => fn();
