// @flow
import * as React from 'react';
import Icon from 'component/common/icon';
import classnames from 'classnames';
import { Link } from '@reach/router';
import { formatLbryUriForWeb } from 'util/uri';

type Props = {
  onClick: ?(any) => any,
  href: ?string,
  title: ?string,
  label: ?string,
  icon: ?string,
  iconRight: ?string,
  disabled: ?boolean,
  children: ?React.Node,
  navigate: ?string,
  className: ?string,
  description: ?string,
  type: string,
  button: ?string, // primary, secondary, alt, link
  noPadding: ?boolean, // to remove padding and allow circular buttons
  iconColor?: string,
  iconSize?: number,
  constrict: ?boolean, // to shorten the button and ellipsis, only use for links
  activeClass?: string,
};

class Button extends React.PureComponent<Props> {
  static defaultProps = {
    type: 'button',
  };

  render() {
    const {
      onClick,
      href,
      title,
      label,
      icon,
      iconRight,
      disabled,
      children,
      navigate,
      className,
      description,
      button,
      type,
      noPadding,
      iconColor,
      iconSize,
      constrict,
      activeClass,
      ...otherProps
    } = this.props;

    const combinedClassName = classnames(
      'button',
      {
        'button--no-padding': noPadding,
      },
      button
        ? {
          'button--primary': button === 'primary',
          'button--secondary': button === 'secondary',
          'button--alt': button === 'alt',
          'button--danger': button === 'danger',
          'button--inverse': button === 'inverse',
          'button--disabled': disabled,
          'button--link': button === 'link',
          'button--constrict': constrict,
        }
        : 'button--no-style',
      className
    );

    const content = (
      <span className="button__content">
        {icon && <Icon icon={icon} iconColor={iconColor} size={iconSize} />}
        {label && <span className="button__label">{label}</span>}
        {children && children}
        {iconRight && <Icon icon={iconRight} iconColor={iconColor} size={iconSize} />}
      </span>
    );

    if (href) {
      return (
        <a href={href} className={combinedClassName}>
          {content}
        </a>
      );
    }

    // Handle lbry:// uris passed in, or already formatted web urls
    let path = navigate;
    if (path) {
      if (path.startsWith('lbry://')) {
        path = formatLbryUriForWeb(path);
      } else if (!path.startsWith('/')) {
        // Force a leading slash so new paths aren't appended on to the current path
        path = `/${path}`;
      }
    }

    return path ? (
      <Link
        to={path}
        title={title}
        onClick={e => e.stopPropagation()}
        getProps={({ isCurrent, isPartiallyCurrent }) => ({
          className:
            (path === '/' ? isCurrent : isPartiallyCurrent) && activeClass
              ? `${combinedClassName} ${activeClass}`
              : combinedClassName,
        })}
      >
        {content}
      </Link>
    ) : (
      <button
        title={title}
        aria-label={description || label || title}
        className={combinedClassName}
        onClick={onClick}
        disabled={disabled}
        type={type}
        {...otherProps}
      >
        {content}
      </button>
    );
  }
}

export default Button;
