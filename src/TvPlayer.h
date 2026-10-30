#pragma once

#include "webview/WebviewWindow.h"

class TvPlayer : public WebviewWindow {
public:
    TvPlayer();
    ~TvPlayer();

protected:
    void onMainWebviewCreateComplete( bool success, WebviewWidget *mainWebview ) override;
    void onSubWebviewCreate( WebviewWidget::Config &config, WebviewWidget *subWebview ) override;
    void onSubWebviewCreateComplete( bool success, WebviewWidget *subWebview ) override;

private:
    bool serveLocalApi( const std::string &requestUrl,
                        const std::string &requestMethod,
                        const std::map<std::string, std::string> &requestHeaders,
                        std::map<std::string, std::string> &responseHeaders,
                        std::string &responseBody,
                        int &statusCode );

    WebviewWidget *m_playerWv = nullptr;
    bool m_playerOnTop = false;
};