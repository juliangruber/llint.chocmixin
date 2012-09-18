var llint = require('llint');

Hooks.addMenuItem('Actions/LESS/LLint', 'cmd-alt-l', lintText);
Hooks.addMenuItem('Actions/CSS/LLint', 'cmd-alt-l', lintText);

function lintText() {
  Recipe.run(function(r) {
    r.text = llint(r.text);
  });
}