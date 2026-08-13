const path = require('path');
// const webpack = require("webpack");

module.exports = {
	mode: "production",
	entry: './src/index.ts',
	output: {
		clean: true,
		filename: 'index.js',
		globalObject: 'this',
		umdNamedDefine: true,
		libraryTarget: 'umd',
		path: path.resolve(__dirname, 'build'),
	},
	module: {
		rules: [
			{
				test: /\.ts?$/,
				use: 'ts-loader',
				exclude: /node_modules/,
			}
		],
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js'],
	}
};
