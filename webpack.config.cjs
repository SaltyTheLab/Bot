const path = require('node:path')
const webpack = require('webpack')
module.exports = {
    mode: 'production',
    entry: './index.js',
    output: {
        filename: 'main-bot.min.js',
        path: path.resolve(__dirname, 'dist')
    },
    externals: {
        'zlib-sync': 'commonjs zlib-sync',
        'bufferutil': 'commonjs bufferutil',
        'utf-8-validate': 'commonjs utf-8-validate',
        'mongodb-client-encryption': 'commonjs mongodb-client-encryption',
        'snappy': 'commonjs snappy',
        'kerberos': 'commonjs kerberos',
        'aws4': 'commonjs aws4',
        'bson-ext': 'commonjs bson-ext', // For C++ BSON speedups
        'sntp': 'commonjs sntp',
        '@mongodb-js/zstd': 'commonjs @mongodb-js/zstd',
        '@aws-sdk/credential-providers': 'commonjs @aws-sdk/credential-providers',
        'gcp-metadata': 'commonjs gcp-metadata',
        'socks': 'commonjs socks',
    },
    optimization: {
        minimize: true
    },
    plugins: [
        new webpack.ContextReplacementPlugin(
            /commands$/,
            (data) => {
                delete data.dependencies[0].critical; // suppress warning
                return data;
            }
        )
    ],
    module: {
        rules: [{
            test: /\.js$/,
            exclude: /node_modules/,
            use: {
                loader: 'babel-loader',
                options: {
                    presets: ['@babel/preset-env']
                }
            }
        }]
    },

    target: 'node'

}