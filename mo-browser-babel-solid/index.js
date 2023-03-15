import Babel from './lib/babel@7.21.2.js';
import jsxTransformPlugin from './lib/babel-plugin-jsx-dom-expressions@0.35.19.js';

function solidPreset(context, options = {}) {
    const plugins = [
        [
            () => Object.assign(jsxTransformPlugin(), { inherits: Babel.availablePlugins['syntax-jsx'] }),
            Object.assign(
                {
                    moduleName: 'solid-js/web',
                    builtIns: [
                        'For',
                        'Show',
                        'Switch',
                        'Match',
                        'Suspense',
                        'SuspenseList',
                        'Portal',
                        'Index',
                        'Dynamic',
                        'ErrorBoundary'
                    ],
                    contextToCustomElements: true,
                    wrapConditionals: true,
                    generate: 'dom'
                },
                options
            )
        ]
    ];
    return { plugins };
}

const replaceImportPlugin = () => {
    return {
        name: 'http-import-replace',
        visitor: {
            ImportDeclaration: (path, { opts }) => {
                const { currentURL, promiseArr } = opts;
                const url = path.node.source.value;
                if (url.startsWith('./') || url.startsWith('../') || url.startsWith('/')) {
                    let newURL = new URL(url, currentURL).href;
                    path.node.source.value = newURL;
                    if (newURL.endsWith('.jsx')) {
                        promiseArr.push(resolveJSX(newURL).then((resolveURL) => [newURL, resolveURL]));
                    }
                }
            }
        }
    };
};

Babel.registerPlugin('transform-jsx', jsxTransformPlugin);
Babel.registerPlugin('http-import-replace', replaceImportPlugin);
Babel.registerPreset('solid', solidPreset);

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
export const resolveJSX = (() => {
    /**
     * @type {{ [srcURL: string]: string }}
     */
    const cacheMappingURL = {};
    /**
     * @param {string} url
     * @returns {Promise<string>}
     */
    return (url) => {
        if (!cacheMappingURL[url]) {
            cacheMappingURL[url] = fetch(url)
                .then((res) => res.text())
                .then((text) => {
                    /**  @type {[string, string][]} */
                    const promiseArr = [];
                    const presets = ['solid'];
                    const plugins = [['http-import-replace', { currentURL: url, promiseArr }]];
                    let code = Babel.transform(text, { presets, plugins }).code;
                    return Promise.all(promiseArr).then((resList) => {
                        for (const [srcURL, desURL] of resList) {
                            code = code.replaceAll(srcURL, desURL);
                        }
                        return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
                    });
                });
        }
        return cacheMappingURL[url];
    };
})();
