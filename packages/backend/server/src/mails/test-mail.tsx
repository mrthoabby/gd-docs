import { Content, P, Template, Title } from './components';

export default function TestMail() {
  return (
    <Template>
      <Title>Test Email from Documentor</Title>
      <Content>
        <P>This is a test email from your Documentor instance.</P>
      </Content>
    </Template>
  );
}
