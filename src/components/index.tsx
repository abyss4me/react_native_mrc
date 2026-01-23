import { Button } from './Button';
import { Keyboard } from './Keyboard';
import { Container } from './Container';
import { ImageComponent } from './Image';
import { TextComponent } from './Text';

// Типізована мапа для використання в Container та ScreenRenderer
export const ComponentMap: Record<string, React.FC<any>> = {
    button: Button,
    keyboard: Keyboard,
    container: Container,
    image: ImageComponent,
    text: TextComponent
};

export { Button, Keyboard, Container, ImageComponent, TextComponent };