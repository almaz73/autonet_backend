import React from 'react'
import { cssClass, themeGet } from '@adminjs/design-system'
import { styled } from '@adminjs/design-system/styled-components'

const StyledLogo = styled.a`
  text-align: center;
  display: flex;
  align-content: center;
  justify-content: center;
  flex-shrink: 0;
  padding: ${themeGet('space', 'lg')} ${themeGet('space', 'xxl')} ${themeGet('space', 'xxl')};
  text-decoration: none;

  & > h1 {
    text-decoration: none;
    font-weight: ${themeGet('fontWeights', 'bolder')};
    font-size: ${themeGet('fontSizes', 'xl')};
    line-height: ${themeGet('lineHeights', 'xl')};
    color: ${themeGet('colors', 'grey80')};
  }

  & > img {
    max-width: 227px;
  }

  &:hover h1 {
    color: ${themeGet('colors', 'primary100')};
  }
`

// штатный SidebarBranding ведёт на rootPath админки, а нужно на главную сайта
const SiteLogo = ({ branding }) => {
    const { logo, companyName } = branding

    return (
        <StyledLogo className={cssClass('Logo')} href='/' data-css='sidebar-logo'>
            {logo ? <img src={logo} alt={companyName}/> : <h1>{companyName}</h1>}
        </StyledLogo>
    )
}

export default SiteLogo
