import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock react-easy-crop since it uses canvas/DOM APIs not available in jsdom
vi.mock('react-easy-crop', () => ({
  default: ({ onCropComplete }: { onCropComplete: (area: unknown, pixels: unknown) => void }) => {
    // Simulate crop area being set
    setTimeout(() => {
      onCropComplete(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 50, y: 50, width: 200, height: 200 }
      )
    }, 0)
    return <div data-testid="cropper">Cropper</div>
  },
}))

import { ImageCropDialog } from '@/components/image-crop-dialog'

describe('ImageCropDialog', () => {
  const mockOnCropComplete = vi.fn()
  const mockOnCancel = vi.fn()
  const testImageSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='

  it('should render the dialog with title and instruction', () => {
    render(
      <ImageCropDialog
        imageSrc={testImageSrc}
        onCropComplete={mockOnCropComplete}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('Crop Profile Photo')).toBeInTheDocument()
    expect(screen.getByText(/close-up of your face/i)).toBeInTheDocument()
  })

  it('should render the cropper component', () => {
    render(
      <ImageCropDialog
        imageSrc={testImageSrc}
        onCropComplete={mockOnCropComplete}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByTestId('cropper')).toBeInTheDocument()
  })

  it('should render Save and Cancel buttons', () => {
    render(
      <ImageCropDialog
        imageSrc={testImageSrc}
        onCropComplete={mockOnCropComplete}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('Save Photo')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('should call onCancel when Cancel button is clicked', () => {
    render(
      <ImageCropDialog
        imageSrc={testImageSrc}
        onCropComplete={mockOnCropComplete}
        onCancel={mockOnCancel}
      />
    )

    fireEvent.click(screen.getByText('Cancel'))
    expect(mockOnCancel).toHaveBeenCalledTimes(1)
  })

  it('should render a zoom slider', () => {
    render(
      <ImageCropDialog
        imageSrc={testImageSrc}
        onCropComplete={mockOnCropComplete}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('Zoom')).toBeInTheDocument()
    const slider = screen.getByRole('slider')
    expect(slider).toBeInTheDocument()
    expect(slider).toHaveAttribute('min', '1')
    expect(slider).toHaveAttribute('max', '3')
  })

  it('should update zoom when slider changes', () => {
    render(
      <ImageCropDialog
        imageSrc={testImageSrc}
        onCropComplete={mockOnCropComplete}
        onCancel={mockOnCancel}
      />
    )

    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '2' } })
    expect(slider).toHaveValue('2')
  })
})
