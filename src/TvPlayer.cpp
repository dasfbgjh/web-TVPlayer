#include "TvPlayer.h"
#include "common/Logger.hpp"

TvPlayer::TvPlayer() {
    WebviewWindow::Config cfg;
    cfg.window.title = "TV Player";
    cfg.window.width = 1500;
    cfg.window.height = 1200;
    cfg.window.center = true;
    cfg.window.resizable = true;
    cfg.window.noBorder = true;
    cfg.window.transparentBackground = true;
    cfg.webview.additionalBrowserArguments = "--autoplay-policy=no-user-gesture-required";
    create( cfg );
}

TvPlayer::~TvPlayer() {
}

void TvPlayer::onMainWebviewCreateComplete( bool success, WebviewWidget *wv ) {
    WebviewWindow::onMainWebviewCreateComplete( success, wv );
    if ( !success ) {
        LOG_WARN << "tv player create fail !";
        return;
    }

    auto *mainWv = getMainWebview();
    mainWv->setName( "tv-main" );
    mainWv->setVirtualHostNameForResources( "tv.app", "/html/app" );
    mainWv->navigate( mainWv->getResourceUrl( "/index.html" ) );

    mainWv->setNewWindowRequestedCallback( []( const std::string &url, bool isUserInitiated, WebView *webView ) -> bool {
        webView->navigate( url );
        return true;
    } );

    mainWv->bind( "togglePlayerZOrder", [this]( const json::array &, WebView * ) -> json::value {
        if ( !m_playerWv )
            return false;
        auto *mainWv = getMainWebview();
        if ( m_playerOnTop ) {
            Widget::changeZOrder( m_playerWv, mainWv );
        } else {
            Widget::changeZOrder( mainWv, m_playerWv );
        }
        m_playerOnTop = !m_playerOnTop;
        return true;
    } );

    mainWv->bind( "toggleFullscreen", [this]( const json::array &, WebView * ) -> json::value {
        bool newState = !isFullscreen();
        setFullscreen( newState );
        return newState;
    } );

    mainWv->bind( "isFullscreen", [this]( const json::array &, WebView * ) -> json::value {
        return isFullscreen();
    } );
}

void TvPlayer::onSubWebviewCreate( WebviewWidget::Config &config, WebviewWidget *subWebview ) {
    subWebview->setAutoWebviewTransparent( false );
    config.window.transparentBackground = false;
    config.window.background = (HBRUSH)GetStockObject( BLACK_BRUSH );
    config.webview.transparentBackground = true;
    config.webview.additionalBrowserArguments = "--autoplay-policy=no-user-gesture-required";

    if ( subWebview->getName() == "player-webview" ) {
        subWebview->addWebResourceRequestedFilter( "http*://*/local/api/*" );
        subWebview->setWebResourceRequestedCallback(
            [this]( const std::string &requestUrl,
                    const std::string &requestMethod,
                    const std::map<std::string, std::string> &requestHeaders,
                    std::map<std::string, std::string> &responseHeaders,
                    std::string &responseBody,
                    int &statusCode ) -> bool {
                return serveLocalApi(
                    requestUrl,
                    requestMethod,
                    requestHeaders,
                    responseHeaders,
                    responseBody,
                    statusCode );
            } );
    }
}

void TvPlayer::onSubWebviewCreateComplete( bool success, WebviewWidget *subWebview ) {
    WebviewWindow::onSubWebviewCreateComplete( success, subWebview );
    if ( !success ) {
        LOG_WARN << "sub webview create fail !";
        return;
    }
    if ( subWebview->getName() == "player-webview" ) {
        m_playerWv = subWebview;

        std::string injectJs = utils::readResource( "/server/inject.js" );
        subWebview->addScriptToExecuteOnDocumentCreated( injectJs, []( const std::string &result, WebView * ) {
            LOG_LOG << "inject script added, id: " << result;
        } );

        subWebview->setNewWindowRequestedCallback(
            []( const std::string &url, bool isUserInitiated, WebView *webView ) -> bool {
                webView->navigate( url );
                return true;
            } );
        Widget::changeZOrder( subWebview, getMainWebview() );
    }
}

bool TvPlayer::serveLocalApi( const std::string &requestUrl,
                              const std::string &requestMethod,
                              const std::map<std::string, std::string> &requestHeaders,
                              std::map<std::string, std::string> &responseHeaders,
                              std::string &responseBody,
                              int &statusCode ) {

    static const std::map<std::string, std::pair<std::string, std::string>> kResources = {
        { "m3u8.html", { "/server/m3u8.html", "text/html; charset=utf-8" } },
        { "hls.js", { "/server/hls.js", "application/javascript; charset=utf-8" } },
    };

    const std::string apiPrefix = "/local/api/";
    size_t prefixPos = requestUrl.find( apiPrefix );
    if ( prefixPos == std::string::npos )
        return false;

    std::string path = requestUrl.substr( prefixPos + apiPrefix.size() );
    size_t queryPos = path.find( '?' );
    if ( queryPos != std::string::npos )
        path = path.substr( 0, queryPos );

    auto it = kResources.find( path );
    if ( it != kResources.end() )
        responseBody = utils::readResource( it->second.first );

    if ( it != kResources.end() && !responseBody.empty() ) {
        statusCode = 200;
        responseHeaders["Content-Type"] = it->second.second;
        LOG_LOG << "local api serve: " << requestUrl;
        return true;
    }

    return false;
}