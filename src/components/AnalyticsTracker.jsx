import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

export default function AnalyticsTracker({ currentPageName }) {
    const location = useLocation();

    useEffect(() => {
        const trackPageView = async () => {
            try {
                // Get or create visitor ID
                let visitorId = localStorage.getItem('visitor_id');
                if (!visitorId) {
                    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    localStorage.setItem('visitor_id', visitorId);
                }

                // Get or create session ID (expires after 30 min of inactivity)
                let sessionId = sessionStorage.getItem('session_id');
                const sessionTimestamp = sessionStorage.getItem('session_timestamp');
                const now = Date.now();
                
                if (!sessionId || !sessionTimestamp || (now - parseInt(sessionTimestamp)) > 30 * 60 * 1000) {
                    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    sessionStorage.setItem('session_id', sessionId);
                }
                sessionStorage.setItem('session_timestamp', now.toString());

                // Detect device type
                const ua = navigator.userAgent;
                let deviceType = 'desktop';
                if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
                    deviceType = 'tablet';
                } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
                    deviceType = 'mobile';
                }

                // Get user ID if authenticated
                let userId = null;
                try {
                    const user = await base44.auth.me();
                    userId = user?.id;
                } catch (e) {
                    // User not authenticated
                }

                // Track the page view
                await base44.entities.Analytics.create({
                    page: currentPageName,
                    path: location.pathname + location.search,
                    referrer: document.referrer || 'direct',
                    user_agent: navigator.userAgent,
                    device_type: deviceType,
                    session_id: sessionId,
                    visitor_id: visitorId,
                    user_id: userId
                });
            } catch (error) {
                // Silently fail - don't disrupt user experience
                console.error('Analytics tracking error:', error);
            }
        };

        trackPageView();
    }, [location, currentPageName]);

    return null;
}