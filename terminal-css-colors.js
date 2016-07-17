
// Monkey-patching the original styling to use class names, not inline styling.

var colorNames = [
	'black',
	'red',
	'green',
	'yellow',
	'blue',
	'magenta',
	'cyan',
	'white'
];

window.Terminal.output.HtmlOutput.prototype._mkAttr = function (attr, extra) {

	if(!attr && !extra)
		return '';

	var attr = Object.assign({}, attr, extra);

	var classes = [];
	for(var p in attr) {
		if(attr[p] === false || attr[p] === null)
			continue;
		switch(p) {
		case "fg":
			if (attr[p] >= 8) {
				classes.push('bright');
			}
			classes.push(colorNames[attr[p]%8]);
			break;
		case "bg":
			classes.push('.background-'+colorNames[attr[p]]);
			break;
		case "inverse":
		case "bold":
		case "italic":
		case "underline":
		case "blink":
		case "doublewidth":
		case "doubleheight":
			classes.push(p);
			break;
		case "$cursor":
		case "$line":
			break;
		}
	}

	return 'class="' + classes.join(' ') + '"';
}
