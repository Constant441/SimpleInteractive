#include "segmented_video_item.h"

#include <QPainter>
#include <QVideoFrameFormat>

SegmentedVideoItem::SegmentedVideoItem(QQuickItem* parent)
    : QQuickPaintedItem(parent)
{
    m_sink = new QVideoSink(this);
    setAcceptedMouseButtons(Qt::NoButton);

    connect(m_sink, &QVideoSink::videoFrameChanged, this, &SegmentedVideoItem::processFrame,
            Qt::DirectConnection);
}

void SegmentedVideoItem::setSensitivity(qreal v)
{
    v = qBound(0.15, v, 0.8);
    if (!qFuzzyCompare(m_sensitivity, v)) {
        m_sensitivity = v;
        emit sensitivityChanged();
    }
}

void SegmentedVideoItem::captureBackground()
{
    QMutexLocker lock(&m_frameMutex);
    if (!m_lastRawFrame.isNull()) {
        QImage rgb = m_lastRawFrame.convertToFormat(QImage::Format_RGB32);
        if (m_background.isNull() || m_background.size() != rgb.size())
            m_background = QImage(rgb.size(), QImage::Format_RGB32);
        m_background = rgb.copy();
        m_backgroundCaptured = true;
        emit backgroundCapturedChanged();
    }
}

void SegmentedVideoItem::paint(QPainter* painter)
{
    QMutexLocker lock(&m_frameMutex);
    if (!m_currentFrame.isNull())
        painter->drawImage(QRect(0, 0, static_cast<int>(width()), static_cast<int>(height())), m_currentFrame);
}

void SegmentedVideoItem::processFrame(const QVideoFrame& frame)
{
    QImage img = frameToImage(frame);
    if (img.isNull())
        return;

    {
        QMutexLocker lock(&m_frameMutex);
        m_lastRawFrame = img.copy();
    }
    QImage result = segmentFrame(img);

    QMutexLocker lock(&m_frameMutex);
    m_currentFrame = result;
    lock.unlock();

    QMetaObject::invokeMethod(this, [this]() { update(); }, Qt::QueuedConnection);
}

QImage SegmentedVideoItem::frameToImage(const QVideoFrame& frame)
{
    QVideoFrame f(frame);
    if (!f.map(QVideoFrame::ReadOnly))
        return QImage();

    QImage::Format fmt = QVideoFrameFormat::imageFormatFromPixelFormat(f.format().pixelFormat());
    QImage img;
    if (fmt != QImage::Format_Invalid) {
        img = QImage(f.bits(), f.width(), f.height(), f.bytesPerLine(), fmt).copy();
    }
    f.unmap();
    if (img.isNull() || img.format() == QImage::Format_Invalid)
        return QImage();
    if (img.format() != QImage::Format_RGB32 && img.format() != QImage::Format_ARGB32)
        img = img.convertToFormat(QImage::Format_RGB32);
    return img;
}

QImage SegmentedVideoItem::segmentFrame(const QImage& frame)
{
    QImage rgb = frame.convertToFormat(QImage::Format_RGB32);
    const int w = rgb.width();
    const int h = rgb.height();

    if (w <= 0 || h <= 0)
        return frame.copy();

    QImage out(w, h, QImage::Format_ARGB32);

    if (!m_backgroundCaptured || m_background.size() != rgb.size()) {
        // Пока фон не захвачен — показываем кадр как есть (альфа 255)
        out = rgb.convertToFormat(QImage::Format_ARGB32);
        return out;
    }

    const int thresh = static_cast<int>(m_sensitivity * 255.0 * 3.0); // порог суммы разниц RGB

    for (int y = 0; y < h; ++y) {
        const QRgb* src = reinterpret_cast<const QRgb*>(rgb.constScanLine(y));
        const QRgb* bg = reinterpret_cast<const QRgb*>(m_background.constScanLine(y));
        QRgb* dst = reinterpret_cast<QRgb*>(out.scanLine(y));

        for (int x = 0; x < w; ++x) {
            int dr = qAbs(qRed(src[x]) - qRed(bg[x]));
            int dg = qAbs(qGreen(src[x]) - qGreen(bg[x]));
            int db = qAbs(qBlue(src[x]) - qBlue(bg[x]));
            int diff = dr + dg + db;

            int alpha = diff > thresh ? 255 : 0;
            dst[x] = qRgba(qRed(src[x]), qGreen(src[x]), qBlue(src[x]), alpha);
        }
    }

    return out;
}
