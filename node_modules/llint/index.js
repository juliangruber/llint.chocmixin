module.exports = function(data) {
  data = data || require('fs').readFileSync(__dirname+'/tests/theme.less').toString();

  var prefixes = ['-moz-', '-o-', '-webkit-'];

  var tree = {data:'', children:[]};
  tree.parent = tree;
  var cur = tree.children[0] = {parent:tree, data:'', children:[]};

  var debug = false;

  var lineBlank = true;
  var skip =false;
  var comment = false;
  var multiComment = false;
  var singleComment = false;
  var newNode = false;
  var newChildNode = false;
  var levelUp = false;
  var attributeEnded = false;
  var blockEnded = false;

  (function parse(tree) {
    for (var i=0; i<data.length; i++) {
      // multi comment
      if (lineBlank && data[i] == '/' && data[i+1] == '*') {
        if (newNode) {
          cur.parent.children.push({parent:cur.parent.parent, data:'', children:[]});
          cur = cur.parent.children[cur.parent.children.length-1];
          newNode = false;
          if (debug) console.log('newNode');
        }
        comment = true;
        multiComment = true;
        if (debug) console.log('multiComment start');
      }
      if (multiComment && data[i-1] == '/' && data[i-2] == '*') {
        comment = false;
        multiComment = false;
        newNode = true;
        if (debug) console.log('multiComment stop');
      }

      // single comment
      if (!multiComment && (data[i] == '/' && data[i+1] == '/')) {
        singleComment = true;
        comment = true;
        if (!lineBlank) newNode = true;
        if (debug) console.log('singleComment start');
      }
      if (singleComment && (data[i] == '\n' || data[i] == '\r')) {
        singleComment = false;
        comment = false;
        newNode = true;
        if (debug) console.log('singleComment stop');
      }

      // block
      if (!comment && data[i] == '{') {
        skip = true;
        newChildNode = true;
      }
      if (!comment && data[i] == '}') {
        skip = true;
        blockEnded = true;
        newNode = true;
      }
      if (newChildNode) {
        cur.children.push({parent:cur, data:'', children:[]});
        cur = cur.children[cur.children.length-1];
        newChildNode = false;
        if (debug) console.log('child node created');
      }
      if (blockEnded) {
        cur = cur.parent;
        blockEnded = false;
        newNode = true;
        if (debug) console.log('blockEnded');
      }

      // attribute
      if (!comment && data[i] == ';') {
        skip = true;
        newNode = true;
      }

      if (newNode && data[i] != ';' && data[i] != '\r' && data[i] != '\n' && data[i] != '\t' && data[i] != '}' && data[i] != ' ' && (data[i] != '/' || lineBlank)) {
         cur.parent.children.push({parent:cur.parent, data:'', children:[]});
         cur = cur.parent.children[cur.parent.children.length-1];
         newNode = false;
         if (debug) console.log('sibling Node created');
      }

      if (!skip) cur.data += data[i];
      if (debug) console.dir(data[i]);
      skip = false;

      if (lineBlank && data[i] != ' ' && data[i] != '\n' && data[i] != '\t') lineBlank = false;
      if (data[i] == '\n' || data[i] == '\r') lineBlank = true;
    }
  })(tree);

  if (debug) console.log(tree);

  (function annotate(tree) {
    if (tree.data) {
      tree.data = clean(tree.data);
      if (tree.data[0] == '@') tree.type = 'variable';
      if (tree.data.search(/(\/\*|\*\/)/) > -1) tree.type = 'comment';
    }
    if (tree.children && tree.children.length) tree.type = 'block';
    if (!tree.type) tree.type = 'attribute';

    if (!tree.children) return;
    for (var i=0; i<tree.children.length; i++) annotate(tree.children[i]);
  })(tree);

  (function reorder(tree) {
    if (tree.type != 'block') return;
    var node;
    for (var i=0; i<tree.children.length; i++) {
      node = tree.children[i];

      if (node.type == 'variable') {
        var b = 0;
        var appendBefore = node.parent.children[b];

        while(appendBefore.type == 'variable' && appendBefore.data < node.data) {
          appendBefore = node.parent.children[++b];
        }

        node.parent.children.splice(i, 1);
        node.parent.children.splice(b, 0, node);
      }

      if (node.type == 'attribute') {
        var b = 0;
        var appendBefore = node.parent.children[b];

        while (appendBefore.type == 'variable' || appendBefore.type == 'attribute' &&
          unprefix(appendBefore.data) < unprefix(node.data)
        ) {
          appendBefore = node.parent.children[++b];
        }

        node.parent.children.splice(i, 1);
        node.parent.children.splice(b, 0, node);
      }

      if (node.type == 'block') reorder(node);
    }
  })(tree);

  function generateLess(tree, nest) {
    nest = nest || '';
    var buf = '';
    var newLine = false;
    if (tree.type != 'block') return nest+buf+';\n';
    var node;
    var lastType;
    for (var i=0; i<tree.children.length; i++) {
      if (newLine) {
        buf += '\n';
        newLine = false;
      }
      node = tree.children[i];

      if (node.data) {
        if (lastType == 'variable' && node.type != lastType) buf += '\n';
        if (lastType == 'attribute' && node.type == 'block') buf += '\n';

        if (node.data.indexOf('//') > 0) {
          buf += nest+clean(node.data.split('//')[0]) + '; //' + node.data.split('//')[1];
        } else {
          buf += nest+node.data;
        }
      }

      lastType = node.type;

      if (node.type != 'block') {
        if (node.data && node.data.indexOf('//') == -1 && node.type != 'comment') buf += ';';
        if (node.type == 'comment') buf += '\n';
        buf += '\n';
        continue;
      }
      buf += ' {\n';
      if (node.type == 'block') buf += generateLess(node, nest+'    ');
      buf += nest+'}\n';
      newLine = true;
    }
    return buf;
  };

  return generateLess(tree);

  function clean(str) {
    return str.replace(/^(\s|\r|\n)+|(\s|\r|\n)+$/g, '');
  }

  function unprefix(str) {
    for (var i=0; i<prefixes.length; i++) str = str.replace(prefixes[i], '');
    return str;
  }
}