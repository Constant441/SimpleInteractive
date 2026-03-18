#include "camera_controller.h"

#include <QCamera>
#include <QCameraDevice>
#include <QMediaCaptureSession>
#include <QMediaDevices>
#include <QVideoFrame>
#include <QVideoSink>

#include <QtMath>
#include <cmath>

namespace {

static inline QRgb thermalColor(int v /*0..255*/)
{
    // Простая "термопалитра": синий -> голубой -> зеленый -> желтый -> красный -> белый
    // с плавными переходами по сегментам.
    v = qBound(0, v, 255);
    const float t = v / 255.0f;

    // 0..1 разделим на 5 сегментов по 0.2
    const float seg = t * 5.0f;
    const int i = qBound(0, int(seg), 4);
    const float f = seg - i;

    auto lerp = [](int a, int b, float k) -> int {
        return int(float(a) + float(b - a) * k + 0.5f);
    };

    // Палитра опорных точек
    static const QRgb pts[5] = {
        qRgb(0, 0, 128),   // blue
        qRgb(0, 255, 255), // cyan
        qRgb(0, 255, 0),   // green
        qRgb(255, 255, 0), // yellow
        qRgb(255, 0, 0)    // red
    };

    // Последний сегмент уедет в белый, чтобы дать "горячие" точки
    const QRgb a = pts[i];
    const QRgb b = (i < 4) ? pts[i + 1] : qRgb(255, 255, 255);

    const int ar = qRed(a), ag = qGreen(a), ab = qBlue(a);
    const int br = qRed(b), bg = qGreen(b), bb = qBlue(b);

    return qRgb(lerp(ar, br, f), lerp(ag, bg, f), lerp(ab, bb, f));
}

class ThermalVideoSink : public QVideoSink
{
public:
    explicit ThermalVideoSink(QObject* parent = nullptr)
        : QVideoSink(parent)
    {
        connect(this, &QVideoSink::videoFrameChanged, this,
                [this](const QVideoFrame& f) { onFrame(f); });
    }

    void setOutputSink(QVideoSink* outputSink)
    {
        m_outputSink = outputSink;
    }

private:
    void onFrame(const QVideoFrame& frame)
    {
        if (!m_outputSink)
            return;
        if (!frame.isValid() || frame.width() <= 0 || frame.height() <= 0)
            return;

        // На первом шаге делаем понятный (но не самый быстрый) путь:
        // конвертируем кадр в QImage силами Qt, затем применяем LUT.
        QImage img = frame.toImage();
        if (img.isNull())
            return;

        // Приведем к градациям серого для дальнейшей обработки.
        img = img.convertToFormat(QImage::Format_Grayscale8);

        const int w = img.width();
        const int h = img.height();

        // Авто-уровни грубо: min/max по подвыборке.
        int minV = 255;
        int maxV = 0;
        const uchar* src = img.constBits();
        const int srcBytesPerLine = img.bytesPerLine();
        const int step = 4;

        for (int y = 0; y < h; y += step) {
            const uchar* row = src + y * srcBytesPerLine;
            for (int x = 0; x < w; x += step) {
                const int v = row[x];
                minV = qMin(minV, v);
                maxV = qMax(maxV, v);
            }
        }
        if (maxV - minV < 10) {
            maxV = minV + 10;
        }

        // LUT можно делать заранее, но для простоты вычислим на лету.
        QImage out(w, h, QImage::Format_RGB32);
        uchar* dst = out.bits();
        const int dstBpl = out.bytesPerLine();

        for (int y = 0; y < h; ++y) {
            const uchar* row = src + y * srcBytesPerLine;
            QRgb* outRow = reinterpret_cast<QRgb*>(dst + y * dstBpl);
            for (int x = 0; x < w; ++x) {
                const int raw = row[x];
                // нормируем в 0..255
                float v = (float(raw - minV) / float(maxV - minV));
                v = qBound(0.0f, v, 1.0f);

                // Gamma для "термокамеры" (делает тени темнее, а горячее ярче)
                v = std::pow(v, 0.75f);
                const int idx = int(v * 255.0f + 0.5f);

                outRow[x] = thermalColor(idx);
            }
        }

        QVideoFrame outFrame(out);
        // Передаем в sink, откуда рисует QML VideoOutput.
        m_outputSink->setVideoFrame(outFrame);
    }

private:
    QVideoSink* m_outputSink = nullptr;
};

} // namespace

CameraController::CameraController(QObject* parent)
    : QObject(parent)
{
    m_session = new QMediaCaptureSession(this);
    m_processingSink = new ThermalVideoSink(this);
    m_session->setVideoSink(m_processingSink);

    m_status = tr("Инициализация…");
    updateDevices();
}

CameraController::~CameraController() = default;

bool CameraController::hasCamera() const
{
    return m_hasCamera;
}

bool CameraController::running() const
{
    return m_running;
}

QString CameraController::status() const
{
    return m_status;
}

void CameraController::updateDevices()
{
    const auto devices = QMediaDevices::videoInputs();
    const bool hasDefault = !QMediaDevices::defaultVideoInput().isNull();

    m_hasCamera = !devices.isEmpty() || hasDefault;
    emit hasCameraChanged();
}

void CameraController::start()
{
    stop();

    updateDevices();
    if (!m_hasCamera) {
        m_status = tr("Веб-камера не найдена.");
        emit statusChanged();
        return;
    }

    if (!m_outputSink) {
        m_status = tr("VideoOutput не задан (сначала вызови setVideoOutput).");
        emit statusChanged();
        return;
    }

    // Выбираем камеру: сначала первую из списка, иначе defaultVideoInput.
    const auto inputs = QMediaDevices::videoInputs();
    QCameraDevice device =
        (!inputs.isEmpty() ? inputs.front() : QMediaDevices::defaultVideoInput());

    if (device.isNull()) {
        m_status = tr("Веб-камера не найдена (device == null).");
        emit statusChanged();
        return;
    }

    auto* camera = new QCamera(device, this);
    m_camera = camera;
    m_session->setCamera(m_camera);

    connect(m_camera, &QCamera::errorOccurred, this,
            [this](QCamera::Error /*error*/, const QString& errorString) {
        m_status = tr("Ошибка камеры: ") + errorString;
        emit statusChanged();
        if (m_running) {
            m_running = false;
            emit runningChanged();
        }
    });

    m_status = tr("Открываю камеру: ") + device.description();
    emit statusChanged();

    m_camera->start();
    m_status = tr("Камера запущена");
    emit statusChanged();
    m_running = true;
    emit runningChanged();
}

void CameraController::stop()
{
    if (m_camera) {
        m_camera->stop();
        m_camera->deleteLater();
        m_camera = nullptr;
    }

    if (m_hasCamera) {
        m_status = tr("Камера остановлена.");
    } else {
        m_status = tr("Веб-камера не найдена.");
    }
    emit statusChanged();
    if (m_running) {
        m_running = false;
        emit runningChanged();
    }
}

void CameraController::setVideoOutput(QObject* videoOutput)
{
    if (m_videoOutput == videoOutput)
        return;

    m_videoOutput = videoOutput;
    if (!m_videoOutput)
        return;

    // Достаем внутренний QVideoSink из QML VideoOutput.
    // VideoOutput имеет read-only property `videoSink` (объект QVideoSink),
    // поэтому в C++ читаем свойство и приводим тип.
    QObject* sinkObj = m_videoOutput->property("videoSink").value<QObject*>();
    m_outputSink = qobject_cast<QVideoSink*>(sinkObj);
    if (m_processingSink) {
        m_processingSink->setOutputSink(m_outputSink);
    }

    // Если камера уже запущена — перезапустим, чтобы поток кадров пошёл в нужный sink.
    if (m_running) {
        stop();
        start();
    }
}

