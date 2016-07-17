var webpack = require("webpack");

module.exports = {
    context: "" ,
    entry: "./node_modules/terminal.js/index",
    output: {
		libraryTarget: "var",
		library: "Terminal",

        path: "./",
        filename: "terminal.js"
    },
    plugins: [
        new webpack.optimize.UglifyJsPlugin()
    ]
};
