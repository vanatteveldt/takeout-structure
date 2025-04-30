import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function InstructionsModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Instructions</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] sm:max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Instructions</DialogTitle>
        </DialogHeader>
        <div className="mt-4 h-[calc(80vh-100px)]">
          <iframe
            src="https://donation-instructions.what-if-horizon.eu/"
            title="Data Donation Instructions"
            className="w-full h-full border-none"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

