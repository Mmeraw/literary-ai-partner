/**
 * /storygate — legacy route
 * Redirects to /storygate-studio (canonical landing page)
 */

import { redirect } from "next/navigation";

export default function StorygateLegacyRedirect() {
  redirect("/storygate-studio");
}
