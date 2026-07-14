interface Props {
  url: string | null | undefined;
  initials: string;
  size?: number;
  fontSize?: number;
}

export function Avatar({ url, initials, size = 42, fontSize = 14 }: Props) {
  const style = { width: size, height: size, fontSize };
  if (url) {
    return (
      <div className="avatar" style={style}>
        <img className="avatar-img" src={url} alt={initials} />
      </div>
    );
  }
  return <div className="avatar" style={style}>{initials}</div>;
}
