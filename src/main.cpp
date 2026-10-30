#include "AppInfo.h"
#include "common/Logger.hpp"
#include "webview/EventLoop.h"
#include "TvPlayer.h"

int main( int argc, char *argv[] ) {
#if APP_BUILD_RELEASE == 0
    system( "chcp 65001 >nul" );
#endif
    Logger::getInstance().setLevel( Logger::Level::LOG );

    EventLoop loop;
    TvPlayer tv;
    loop.exec();

    return 0;
}