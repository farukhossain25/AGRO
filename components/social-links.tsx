import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  Send,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { getSocialLinks, isSocialIcon, safeHref, type SocialPlacement } from "@/lib/content";

/* ==========================================================================
   <SocialLinks /> — server-rendered, admin-managed
   --------------------------------------------------------------------------
   Rendered on the server so the icons cost zero client JS and the links are in
   the initial HTML for crawlers. `icon` is resolved through a fixed map, so a
   bad value from the admin panel falls back to a globe instead of throwing.

   `safeHref` blocks javascript: and data: URLs — an admin account is trusted,
   but a compromised one should not get stored XSS on every page.
   ========================================================================== */

const ICONS: Record<string, LucideIcon> = {
  Facebook,
  Youtube,
  Instagram,
  Music2,
  MessageCircle,
  Send,
  Twitter,
  Linkedin,
  Globe,
  Phone,
  Mail,
  MapPin,
};

export async function SocialLinks({
  placement,
  className = "",
  size = "md",
  tone = "light",
}: {
  placement: SocialPlacement;
  className?: string;
  size?: "sm" | "md";
  /** `dark` = rendered on the footer's deep-green panel. */
  tone?: "light" | "dark";
  showLabel?: boolean;
}) {
  const links = await getSocialLinks(placement);
  if (!links.length) return null;

  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <ul className={`flex items-center gap-1.5 ${className}`} aria-label="সোশ্যাল মিডিয়া">
      {links.map((link) => {
        const Icon = (isSocialIcon(link.icon) && ICONS[link.icon]) || ICONS.Globe;
        const label = link.label_bn ?? link.platform;

        return (
          <li key={link.id}>
            <a
              href={safeHref(link.url)}
              target={link.url.startsWith("http") ? "_blank" : undefined}
              rel={link.url.startsWith("http") ? "noopener noreferrer me" : undefined}
              aria-label={label}
              title={label}
              className={
                tone === "dark"
                  ? // arbitrary rgba: bg-white/* and text-sand-* are remapped by the light theme
                    `grid ${box} place-items-center rounded-full bg-[rgba(255,255,255,0.08)] text-white/75 transition hover:bg-[rgba(255,255,255,0.18)] hover:text-white`
                  : `grid ${box} place-items-center rounded-full bg-white/[0.06] text-sand-100/60 transition hover:bg-leaf-600/25 hover:text-leaf-700`
              }
              style={link.color ? { color: link.color } : undefined}
            >
              <Icon className={icon} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Inline variant for the contact page, with the platform name beside the icon. */
export async function SocialLinksList({ placement = "contact" }: { placement?: SocialPlacement }) {
  const links = await getSocialLinks(placement);
  if (!links.length) return null;

  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {links.map((link) => {
        const Icon = (isSocialIcon(link.icon) && ICONS[link.icon]) || ICONS.Globe;
        return (
          <li key={link.id}>
            <a
              href={safeHref(link.url)}
              target={link.url.startsWith("http") ? "_blank" : undefined}
              rel={link.url.startsWith("http") ? "noopener noreferrer me" : undefined}
              className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-[12.5px] transition hover:border-leaf-500/40 hover:bg-white/[0.06]"
            >
              <Icon className="h-4 w-4 shrink-0 text-leaf-300" />
              <span className="min-w-0 flex-1 truncate">{link.label_bn ?? link.platform}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
