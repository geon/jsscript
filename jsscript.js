
function Reader (dataView) {

	this.dataView = dataView;
	this.pos = 0;
	this.lastFrameTime = 0;
}

Reader.prototype.getUint32 = function (littleEndian) {

	var pos = this.pos;
	this.pos += 4;
	return this.dataView.getUint32(pos, littleEndian);
};

// Not reeeally 64 bits. More like 56, because js use floats.
Reader.prototype.getUint64 = function (littleEndian) {

	var first  = this.getUint32(littleEndian);
	var second = this.getUint32(littleEndian);

	return littleEndian
		? (second << 32) | first
		: (first  << 32) | second;
}

Reader.prototype.getString = function (length) {

	var arrayBuffer = this.dataView.buffer.slice(this.pos, this.pos + length);
	this.pos += length;
	return String.fromCharCode.apply(null, new Uint8Array(arrayBuffer));
}


Reader.prototype.getStamp = function () {

	if (this.pos + 24 > this.dataView.byteLength) {

		return null;
	}

	// Detect Endianness. This value should be an ascii char, stored in 32 bits.
	// Unlike in the original C source, the endianness can’t be fixed after reading, since js numbers only have 56 bits of precision.
	var littleEndian = this.dataView.getUint32(this.pos + 20) > 0xff;

	// Read the stamp.
	var stamp = {
		// Length of text data in bytes.
		scr_len: this.getUint64(littleEndian),
		// Delay in seconds plus microseconds.
		scr_sec: this.getUint64(littleEndian),
		scr_usec: this.getUint32(littleEndian),
		// Input/output, start/end.
		scr_direction: this.getUint32(littleEndian)
	};

	return stamp;
}

Reader.prototype.getFrame = function () {

	// Find the next o-frame.
	var stamp;
	while (stamp = this.getStamp()) {

		// Convert the weird time format to js friendly milliseconds.
		var time = stamp.scr_sec * 1000 + stamp.scr_usec / 1000;

		var content = this.getString(stamp.scr_len);

		switch (String.fromCharCode(stamp.scr_direction)) {
			case 's':
				// Initialize the time.
				this.lastFrameTime = time;
				break;
			case 'e':
			case 'i':
				break;
			case 'o':
				var lastFrameDuration = time - this.lastFrameTime;
				this.lastFrameTime = time;
				return {
					delay: lastFrameDuration,
					content: content
				};
				break;
			default:
				throw new Error("Invalid direction.");
		}
	}
}

function terminalCast (el, url) {

	var req = new XMLHttpRequest();
	req.open("GET", url, true);
	req.responseType = "arraybuffer";

	req.onload = function (oEvent) {
		var arrayBuffer = req.response;
		if (arrayBuffer) {

			var reader = new Reader(new DataView(arrayBuffer));
			var screen = new ScreenState(el);

			function play () {

				var frame = reader.getFrame();
				if (frame) {

					setTimeout(function () {

						screen.applyFrame(frame.content);
						play();

					}, frame.delay);
				}
			}

			play();
		}
	};

	req.send();
}










function ScreenState (el) {

	this.el = el;
	this.cursorAttributes = {};
}

ScreenState.prototype.insertString = function (string) {

	var row = this.el.children[this.cursorAttributes.row];
	if (!row) {

		row = document.createElement('span');
		this.el.appendChild(row);
	}

	string.split('')
		.forEach(function (char) {

			var cell = document.createElement('span');
			cell.className = this.classNameFromCursorAttribute();
			cell.innerText = char;

			var cellCurrentlyAtPosition = row.children[this.cursorAttributes.collumn];
			if (cellCurrentlyAtPosition) {

				row.insertBefore(cell, cellCurrentlyAtPosition);
				// Overwrite.
				cellCurrentlyAtPosition.remove();

			} else {

				row.appendChild(cell);
			}

			++ this.cursorAttributes.col;
		}.bind(this));
};

ScreenState.prototype.classNameFromCursorAttribute = function () {

	return (
		(this.cursorAttributes.bright
			? 'bright '
			: ''
		) +
		(this.cursorAttributes.foreground
			? (this.cursorAttributes.foreground + ' ')
			: ''
		) +
		(this.cursorAttributes.background
			? (this.cursorAttributes.background + '-background')
			: ''
		)
	);
}

ScreenState.prototype.applyFrame = function (content) {

	// CSI control sequences. Threre are also 2-char patterns like this: /\x1b([^@-_][@-_]) but they don't seem to be used.
	var codePattern = /\x1b\[([^@-~]+[@-~])/;

	// Split saves the matched parenthesis (the code) between each split string fragment.
	content
		.split(codePattern)
		.forEach(function(textOrCode, index) {

			if (index%2) {

				this.applyCode(textOrCode);

			} else {

				this.insertString(textOrCode);
			}
		}.bind(this));
}

ScreenState.prototype.applyCode = function (code) {

	// var positionPatterns = [
	// 	'\d+;\d+H', // set position row;col
	// 	'\d+[A-D]', // up/down/right/left
	// ]

	if (/[\d;]+m/.test(code)) {

		this.applyColorCode(code);
		return;
	}

	console.warn('Unknown control code:', code);
}

ScreenState.prototype.applyColorCode = function (code) {

	var colors = [
		'black',
		'red',
		'green',
		'yellow',
		'blue',
		'magenta',
		'cyan',
		'white'
	];

	// Lop off the ending 'm', split by ';'.
	code.slice(0, -1).split(';').forEach(function (code) {

		var numericCode = parseInt(code, 10);
		switch (Math.floor(numericCode / 10)) {
			case 0:
				switch (numericCode) {
					case 0:
						this.cursorAttributes = {};
						break;
					case 1:
						this.cursorAttributes.bright = true;
						break;
					case 2:
						this.cursorAttributes.bright = false;
						break;

					default:
						console.warn('Unknown color control code:', code);
						break;
				}
				break;
			case 3:
				this.cursorAttributes.foreground = colors[numericCode - 30];
				break;
			case 4:
				this.cursorAttributes.background = colors[numericCode - 40];
				break;

			default:
				console.warn('Unknown color control code:', code);
				break;
		}
	}.bind(this));
}
