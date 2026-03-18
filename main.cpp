#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>

#include "camera_controller.h"


int main(int argc, char* argv[])
{
    QGuiApplication app(argc, argv);

    QQmlApplicationEngine engine;

    CameraController cameraController(&app);
    engine.rootContext()->setContextProperty("cameraController", &cameraController);

    QObject::connect(
        &engine, &QQmlApplicationEngine::objectCreationFailed, &app, []() { QCoreApplication::exit(-1); },
        Qt::QueuedConnection);
    engine.loadFromModule("TermoCam", "Main");

    return app.exec();
}
