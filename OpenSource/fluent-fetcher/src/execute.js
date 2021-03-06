// @flow

//自动进行全局的ES6 Promise的Polyfill
require("es6-promise").polyfill();

type strategyType = {
  // 是否需要添加进度监听回调
  onProgress: (progress: number) => {},
  // 是否属于 Jsonp 请求
  Jsonp: boolean
};

/**
 * @function 根据传入的请求配置发起请求并进行预处理
 * @param url
 * @param option
 * @param {*} acceptType
 * @param strategy
 */
export default function execute(
  url: string,
  option: any = {},
  acceptType: string = "json",
  strategy: strategyType = {}
): Promise<any> {
  if (!url) {
    throw new Error("地址未定义");
  }

  let promise: Promise<any>;

  if (strategy.Jsonp) {
    // 加载 Jsonp
    require("fetch-jsonp");

    // Jsonp 只能是 Get 请求，并且不能带函数
    promise = fetch(url);
  } else {
    // 这里再选择自动注入的代码
    require("isomorphic-fetch");

    // 这里判断是否为 Node 环境，是 Node 环境则设置环境变量
    if (typeof process !== "undefined") {
      // 避免 HTTPS 错误
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    //构建fetch请求
    promise = fetch(url, option);
  }

  // 添加基本的处理逻辑
  promise = promise
    .then(
      response => _checkStatus(response, acceptType),
      error => {
        throw error;
      }
    )
    .then(acceptType === "json" ? _parseJSON : _parseText, error => {
      throw error;
    });

  // 以高阶函数的方式封装 Promise 对象

  return _decorate(promise);
}

/**
 * @function 检测返回值的状态
 * @param response
 * @param acceptType
 * @returns {*}
 */
async function _checkStatus(response, acceptType) {
  if (
    (response.status >= 200 && response.status < 300) || response.status === 0
  ) {
    return response;
  } else {
    // 获取响应体
    let body = acceptType === "json"
      ? await response.json()
      : await response.text();

    // 封装错误对象
    throw new Error(
      JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        body: body
      })
    );
  }
}

/**
 * @function 解析返回值中的Response为JSON形式
 * @param response
 * @returns {*}
 */
function _parseJSON(response) {
  if (!!response) {
    return response.json();
  } else {
    return {};
  }
}

/**
 * @function 解析TEXT性质的返回
 * @param response
 * @returns {*}
 */
function _parseText(response: Response): Promise<string> | string {
  if (!!response) {
    return response.text();
  } else {
    return "";
  }
}

/**
 * @function 判断是否为Weapp
 * @private
 * @return boolean
 */
function _isWeapp(): boolean {
  return typeof window.wx !== "undefined";
}

/**
 * @function 将原始的 Promise 进行封装
 * @private
 * @param initialpromise
 */
function _decorate(initialpromise: Promise<any>): Promise<any> {
  let abortFunction;

  // 默认 60 秒过时
  let timeout = 0;

  let abortablePromise = new Promise((resolve, reject) => {
    // 闭包方式传递对象
    abortFunction = () => {
      reject("Abort or Timeout");
    };
  });

  let promise = Promise.race([initialpromise, abortablePromise]);

  promise.abort = abortFunction;

  // 定义 timeout 对象
  Object.defineProperty(promise, "timeout", {
    set: function(ts) {
      if ((ts = +ts)) {
        timeout = ts;
        setTimeout(abortFunction, ts);
      }
    },
    get: function() {
      return timeout;
    }
  });

  return promise;
}
