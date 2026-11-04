export function Logo() {
  return (
    <span className="tnc-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/ape-logo.webp" alt="The Anxious Patient Experience" height={44} />
    </span>
  )
}

export function Icon() {
  return (
    <span className="tnc-logo tnc-logo--icon">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/ape-logo.webp" alt="" height={26} />
    </span>
  )
}

export default Logo
