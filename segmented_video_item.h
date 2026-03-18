#pragma once

#include <QQuickPaintedItem>
#include <QVideoSink>
#include <QVideoFrame>
#include <QImage>
#include <QMutex>

class SegmentedVideoItem : public QQuickPaintedItem
{
    Q_OBJECT
    Q_PROPERTY(QVideoSink* videoSink READ videoSink CONSTANT)
    Q_PROPERTY(bool backgroundCaptured READ backgroundCaptured NOTIFY backgroundCapturedChanged)
    Q_PROPERTY(qreal sensitivity READ sensitivity WRITE setSensitivity NOTIFY sensitivityChanged)

public:
    explicit SegmentedVideoItem(QQuickItem* parent = nullptr);

    QVideoSink* videoSink() const { return m_sink; }
    bool backgroundCaptured() const { return m_backgroundCaptured; }
    qreal sensitivity() const { return m_sensitivity; }
    void setSensitivity(qreal v);

    Q_INVOKABLE void captureBackground();

signals:
    void backgroundCapturedChanged();
    void sensitivityChanged();

protected:
    void paint(QPainter* painter) override;

private:
    void processFrame(const QVideoFrame& frame);
    static QImage frameToImage(const QVideoFrame& frame);
    QImage segmentFrame(const QImage& frame);

    QVideoSink* m_sink = nullptr;
    QImage m_currentFrame;      // последний кадр с альфой (персонa)
    QImage m_lastRawFrame;     // последний сырой кадр (для захвата фона)
    QImage m_background;       // захваченный фон
    bool m_backgroundCaptured = false;
    qreal m_sensitivity = 0.35; // порог отличия от фона (0.2–0.6)
    QMutex m_frameMutex;
};
