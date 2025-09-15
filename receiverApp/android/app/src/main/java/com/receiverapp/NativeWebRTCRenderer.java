package com.receiverapp;

import android.content.Context;
import android.util.Log;
import android.view.View;
import android.widget.FrameLayout;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

import org.webrtc.AudioSource;
import org.webrtc.AudioTrack;
import org.webrtc.Camera1Enumerator;
import org.webrtc.Camera2Enumerator;
import org.webrtc.CameraEnumerator;
import org.webrtc.DefaultVideoDecoderFactory;
import org.webrtc.DefaultVideoEncoderFactory;
import org.webrtc.EglBase;
import org.webrtc.IceCandidate;
import org.webrtc.Logging;
import org.webrtc.MediaConstraints;
import org.webrtc.MediaStream;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.RendererCommon;
import org.webrtc.SessionDescription;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.SurfaceViewRenderer;
import org.webrtc.VideoDecoderFactory;
import org.webrtc.VideoEncoderFactory;
import org.webrtc.VideoSource;
import org.webrtc.VideoTrack;
import org.webrtc.audio.AudioDeviceModule;
import org.webrtc.audio.JavaAudioDeviceModule;

import java.util.ArrayList;
import java.util.List;

public class NativeWebRTCRenderer extends SimpleViewManager<FrameLayout> {
    private static final String TAG = "NativeWebRTCRenderer";
    private static final String REACT_CLASS = "NativeWebRTCRenderer";

    private EglBase rootEglBase;
    private PeerConnectionFactory peerConnectionFactory;

    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @Override
    protected FrameLayout createViewInstance(ThemedReactContext reactContext) {
        Log.d(TAG, "Creating native WebRTC renderer view");
        
        FrameLayout container = new FrameLayout(reactContext);
        
        // Initialize WebRTC components
        initializeWebRTC(reactContext);
        
        // Create SurfaceViewRenderer with hardware acceleration
        SurfaceViewRenderer surfaceRenderer = new SurfaceViewRenderer(reactContext);
        surfaceRenderer.setMirror(false);
        surfaceRenderer.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FIT);
        
        // Initialize renderer with EGL context
        if (rootEglBase != null) {
            surfaceRenderer.init(rootEglBase.getEglBaseContext(), null);
            Log.d(TAG, "SurfaceViewRenderer initialized with EGL context");
        }
        
        // Add to container
        container.addView(surfaceRenderer, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        
        // Store renderer reference for later use
        container.setTag(surfaceRenderer);
        
        return container;
    }

    private void initializeWebRTC(Context context) {
        // Initialize PeerConnectionFactory with hardware acceleration
        PeerConnectionFactory.InitializationOptions initOptions = 
            PeerConnectionFactory.InitializationOptions.builder(context)
                .setEnableInternalTracer(true)
                .setFieldTrials("WebRTC-H264HighProfile/Enabled/")
                .createInitializationOptions();
        
        PeerConnectionFactory.initialize(initOptions);
        
        // Create EGL base context for hardware acceleration
        rootEglBase = EglBase.create();
        
        // Create video decoder factory with hardware acceleration
        VideoDecoderFactory videoDecoderFactory = new DefaultVideoDecoderFactory(rootEglBase.getEglBaseContext());
        VideoEncoderFactory videoEncoderFactory = new DefaultVideoEncoderFactory(rootEglBase.getEglBaseContext(), true, true);
        
        // Create audio device module
        AudioDeviceModule audioDeviceModule = JavaAudioDeviceModule.builder(context)
            .setUseHardwareAcousticEchoCanceler(false)
            .setUseHardwareNoiseSuppressor(false)
            .createAudioDeviceModule();
        
        // Build PeerConnectionFactory
        peerConnectionFactory = PeerConnectionFactory.builder()
            .setVideoDecoderFactory(videoDecoderFactory)
            .setVideoEncoderFactory(videoEncoderFactory)
            .setAudioDeviceModule(audioDeviceModule)
            .createPeerConnectionFactory();
        
        Log.d(TAG, "WebRTC PeerConnectionFactory initialized with hardware acceleration");
    }

    @ReactProp(name = "streamUrl")
    public void setStreamUrl(FrameLayout container, String streamUrl) {
        Log.d(TAG, "Setting stream URL: " + streamUrl);
        
        SurfaceViewRenderer renderer = (SurfaceViewRenderer) container.getTag();
        if (renderer != null && streamUrl != null) {
            // This would typically connect to WebRTC stream
            // For now, we'll prepare the renderer for incoming video tracks
            Log.d(TAG, "Renderer prepared for stream: " + streamUrl);
        }
    }

    // Method to attach video track to renderer (called from JS)
    public void attachVideoTrack(FrameLayout container, VideoTrack videoTrack) {
        SurfaceViewRenderer renderer = (SurfaceViewRenderer) container.getTag();
        if (renderer != null && videoTrack != null) {
            Log.d(TAG, "Attaching video track to native renderer");
            videoTrack.addSink(renderer);
        }
    }

    @Override
    public void onDropViewInstance(FrameLayout container) {
        Log.d(TAG, "Dropping native WebRTC renderer view");
        
        SurfaceViewRenderer renderer = (SurfaceViewRenderer) container.getTag();
        if (renderer != null) {
            renderer.release();
        }
        
        if (rootEglBase != null) {
            rootEglBase.release();
            rootEglBase = null;
        }
        
        super.onDropViewInstance(container);
    }
}