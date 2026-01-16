import Link from "next/link";

const NAV = [
  { label: "Evaluate", href: "/evaluate" },
  { label: "Revise", href: "/revise" },
  { label: "Convert", href: "/convert" },
  { label: "Output", href: "/outputs" },
  { label: "Storygate Studio", href: "/storygate" },
  { label: "Resources", href: "/resources" },
  { label: "Pricing", href: "/pricing" },
  { label: "Sign in", href: "/signin" },
];

export default function HeaderNav() {
  return (
    <header style={{ width: "100%", borderBottom: "1px solid #ddd", background: "#fff" }}>
      <nav
        style={{
          maxWidth: "80rem",
          margin: "0 auto",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: "18px" }}>RevisionGrade™</div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "14px" }}>
          {NAV.map((item) => {
            const isStorygate = item.href === "/storygate";

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  textDecoration: "underline",
                  color: isStorygate ? "#ff0000" : "#0000ee",
                  fontWeight: isStorygate ? 700 : 400,
                }}
              >
                {isStorygate ? (
                  <>
                    Storygate Studio<sup>™</sup>
                  </>
                ) : (
                  item.label
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
